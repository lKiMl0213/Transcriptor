# Whisper Transcription Server

Sistema de transcrição de áudio com **FastAPI** (backend) + frontend simples (HTML/CSS/JS).  
Usa o modelo **faster-whisper** para transcrever áudio após conversão para WAV via FFmpeg. Suporta cancelamento de transcrições em andamento.

---

## Funcionalidades

- Upload de arquivos de áudio (qualquer formato suportado pelo FFmpeg).
- Conversão automática para **WAV mono 16kHz** antes da transcrição.
- Transcrição com `faster-whisper` (ex.: `large-v2`).
- Endpoint para **interromper** transcrição em execução.
- Frontend básico que mostra nome do arquivo e transcrição em balões.
- Opção de expor a aplicação com **ngrok** para testes externos.

---

## Requisitos

- Python 3.9+
- FFmpeg (executável disponível no PATH)
- GPU é opcional; o exemplo usa CPU por padrão (`device="cpu"`). Se quiser GPU, ajuste `server.py` e instale dependências compatíveis.

---

## Instalação (passo a passo)

1. Clone o repositório:
```bash
git clone https://github.com/lKiMl0213/Transcriptor.git
cd Transcriptor
```

2. Crie e ative um ambiente virtual:
Linux / macOS:
```bash
python3 -m venv .venv
source .venv/bin/activate
```
Windows (PowerShell):
```powershell
python -m venv .venv
.venv\Scripts\activate
```

3. Instale dependências:
- Se você já tem um `requirements.txt`, rode:
```bash
pip install -r requirements.txt
```
- Se preferir instalar manualmente, exemplo:
```bash
pip install fastapi uvicorn faster-whisper ffmpeg-python python-multipart aiofiles
```

4. Verifique o FFmpeg:
- No terminal, rode:
```bash
ffmpeg -version
```
Se não aparecer, instale o FFmpeg (veja abaixo como instalar em Linux/Windows/macOS).

---

## Arquivo `requirements.txt` (exemplo)

Conteúdo sugerido (salve como `requirements.txt`):
```
fastapi
uvicorn[standard]
faster-whisper
ffmpeg-python
python-multipart
aiofiles
```

Para gerar a partir do seu ambiente (após instalar libs):
```bash
pip freeze > requirements.txt
```

---

## Executando o servidor

Rode (no diretório onde está `server.py`):
```bash
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

Endpoints principais:
- `GET /` → retorna `frontend/index.html` (ou `http://localhost:8000/static/index.html`).
- `POST /transcribe` → envia arquivo (`multipart/form-data`, campo `audio`) e recebe JSON `{ "text": "..." }`.
<!-- EM BREVE - `POST /stop` → solicita parada da transcrição atual; retorna status. -->

Exemplo com `curl`:
```bash
curl -X POST "http://127.0.0.1:8000/transcribe" -F "audio=@meu_audio.mp3"
```

Interromper:
```bash
curl -X POST "http://127.0.0.1:8000/stop"
```

---

## Frontend

O frontend está em `frontend/` (HTML, CSS, JS).  
Ele faz upload para `/transcribe` e exibe resultado em balões de chat. Ao selecionar um arquivo, o input mostra o nome do arquivo — e a bolha do usuário também exibirá somente o nome.

---

## FFmpeg: instalação rápida

**Linux (Debian/Ubuntu)**:
```bash
sudo apt update
sudo apt install ffmpeg
```

**macOS (Homebrew)**:
```bash
brew install ffmpeg
```

**Windows**:
1. Baixe em https://ffmpeg.org/download.html (builds do gyan/mkg)
2. Extraia e adicione a pasta `bin` ao `PATH`.
3. Teste com `ffmpeg -version` no PowerShell.

---

## Expor local para web (opcional) — ngrok

1. Instale ngrok (https://ngrok.com/download).  
2. Adicione token:
```bash
ngrok config add-authtoken SEU_TOKEN_AQUI
```
3. Com servidor rodando (porta 8000), execute:
```bash
ngrok http 8000
```
ngrok retorna uma URL pública (`https://xxxxx.ngrok-free.app`) que proxya para seu localhost.

---

## Observações técnicas / limitações

- O servidor usa um lock para garantir **apenas uma transcrição por vez**. Chamadas concorrentes recebem 429 (Servidor ocupado).
<!-- EM BREVE - O endpoint `/stop` aciona um evento para interromper o loop de transcrição e retornar texto parcial. -->
- Se usar GPU, ajuste o `device` e `compute_type` no `server.py`, e instale dependências de acordo (ex.: PyTorch com suporte CUDA).
- A conversão com `ffmpeg-python` depende do binário `ffmpeg` estar instalado.

---

## Estrutura do projeto

```
.
├── audiototext.py
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── script.js
├── requirements.txt
├── README.md
└── LICENSE.md
```

---

## Troubleshooting rápido

- **Erro: ffmpeg not found** → instale o FFmpeg e verifique `ffmpeg -version`.
- **Erro: servidor ocupado / 429** → aguarde a transcrição terminar ou chame `POST /stop`.
- **Performance ruim em CPU** → considere usar um modelo menor (ex.: `base`, `small`) ou GPU.

---

## Licença

Este projeto está licenciado sob a **MIT License** — veja `LICENSE.md`.
