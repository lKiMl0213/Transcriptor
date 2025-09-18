# Transcriptor

Interface web simples para envio de arquivos de áudio, simulação de progresso e exibição da transcrição em estilo de chat.

## ✨ Funcionalidades
- Upload de arquivos de áudio/video.
- Exibição do nome do arquivo selecionado no input e no chat.
- Simulação de progresso de envio e análise.
- Loader animado durante a transcrição.
- Exibição da transcrição em balões de chat.

## 🚀 Tecnologias
- Python
- HTML5 + CSS3
- JavaScript (Vanilla)

## 📦 Requisitos
- Python 3.9+
- FFmpeg instalado e acessível no PATH  
  - Linux: `sudo apt install ffmpeg`  
  - Windows: [Baixar FFmpeg](https://ffmpeg.org/download.html) e adicionar ao PATH

---

## ⚙️ Instalação
```bash
# Clone o repositório
git clone https://github.com/seu-usuario/transcriptor.git
cd transcriptor

# Crie e ative um ambiente virtual
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
.venv\Scripts\activate      # Windows

# Instale as dependências
pip install -r requirements.txt

# Rodar o servidor
uvicorn audiototext:app --host 0.0.0.0 --port 8000 --reload

# 
ngrok http 8000