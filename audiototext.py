# server.py
import os
import ffmpeg
import tempfile
import threading
import asyncio
from fastapi import FastAPI, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from faster_whisper import WhisperModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Inicializa o modelo (uma única instância)
model = WhisperModel("large-v2", device="cpu", compute_type="float32")

# Controle global (suporta UMA transcrição ativa de cada vez)
current_task_lock = threading.Lock()
current_stop_event = None  # threading.Event quando há uma transcrição ativa

def convert_to_wav(input_path):
    output_path = os.path.splitext(input_path)[0] + "_converted.wav"
    (
        ffmpeg.input(input_path)
        .output(output_path, ac=1, ar=16000)
        .overwrite_output()
        .run(capture_stdout=True, capture_stderr=True)
    )
    return output_path

def transcribe_with_cancel(wav_path, stop_event, language="pt"):
    """
    Função executada em executor (thread). Itera sobre os segmentos e
    verifica stop_event a cada segmento.
    Retorna (aborted_flag, text)
    """
    text_parts = []
    # model.transcribe retorna um gerador de segmentos (iterável)
    segments, info = model.transcribe(wav_path, language=language, beam_size=3, best_of=3)
    for segment in segments:
        # checa flag de parada
        if stop_event.is_set():
            # retorna texto parcial com marcação de abortado
            return True, " ".join([p.strip() for p in text_parts]).strip()
        # acumula texto do segmento
        text_parts.append(segment.text.strip())
    return False, " ".join([p.strip() for p in text_parts]).strip()

@app.post("/transcribe")
async def transcribe(audio: UploadFile):
    global current_stop_event
    # bloqueia para garantir apenas uma transcrição ativa
    if not current_task_lock.acquire(blocking=False):
        # já existe transcrição rodando
        raise HTTPException(status_code=429, detail="Servidor ocupado com outra transcrição. Tente novamente.")

    try:
        # cria Event para esta transcrição
        stop_event = threading.Event()
        current_stop_event = stop_event

        # salva arquivo recebido
        with tempfile.NamedTemporaryFile(suffix=os.path.splitext(audio.filename)[1] or ".wav", delete=False) as tmp:
            tmp.write(await audio.read())
            tmp.flush()
            tmp_path = tmp.name

        wav_path = convert_to_wav(tmp_path)

        # executa transcrição em thread pool para não bloquear o loop async
        loop = asyncio.get_running_loop()
        aborted, text = await loop.run_in_executor(None, transcribe_with_cancel, wav_path, stop_event, "pt")

        # limpa arquivos temporários
        try:
            os.remove(tmp_path)
        except:
            pass
        try:
            os.remove(wav_path)
        except:
            pass

        # reseta sinal global
        current_stop_event = None

        if aborted:
            return JSONResponse({"text": text, "aborted": True})
        return {"text": text}

    finally:
        # libera lock para a próxima transcrição
        if current_task_lock.locked():
            current_task_lock.release()
        current_stop_event = None

@app.post("/stop")
async def stop_processing():
    """
    Endpoint chamado pelo frontend para interromper o processamento atual.
    """
    global current_stop_event
    if current_stop_event is None:
        return {"status": "no_active_task"}
    current_stop_event.set()
    return {"status": "stopping"}

@app.get("/")
def home():
    return FileResponse("frontend/index.html")
