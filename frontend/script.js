const chat = document.getElementById('chat-container');
const fileInput = document.getElementById('file');
const messageInput = document.getElementById('messageInput');

fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (f) {
    messageInput.value = f.name;            // mostra o nome do arquivo no input
    messageInput.placeholder = f.name;      // opcional: atualiza placeholder também
  } else {
    messageInput.value = '';
    messageInput.placeholder = 'Message...';
  }
});

function addMessage(text, type) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg ' + type;
  msgDiv.textContent = text;
  chat.appendChild(msgDiv);
  chat.scrollTop = chat.scrollHeight;
  return msgDiv;
}

/* Escreve o texto no estilo máquina de escrever */
function displayTextAnimated(text, callback) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'msg bot';
  chat.appendChild(msgDiv);

  const words = text.split(' ');
  let i = 0;
  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);
      if (callback) callback();
      return;
    }
    msgDiv.textContent += (words[i] + ' ');
    i++;
    chat.scrollTop = chat.scrollHeight;
  }, 25); // 25ms por palavra
}

/* Exibe cada frase transcrita em um balão separado */
function displaySentences(sentences, index = 0) {
  if (index >= sentences.length) return;
  displayTextAnimated(sentences[index], () => displaySentences(sentences, index + 1));
}

/* Simula progresso de envio e transcrição */
function simulateProgress(file, stopSignal) {
  return new Promise(async (resolve) => {
    const sendingMsg = addMessage("Enviando áudio...", "user");
    await new Promise(r => setTimeout(r, 1000));
    sendingMsg.textContent = "Enviando áudio... OK";

    const analyzingMsg = addMessage("Analisando áudio...", "bot");
    await new Promise(r => setTimeout(r, 1000));
    analyzingMsg.textContent = "Analisando áudio... OK";

    // Cria bolha do loader
    const loaderMsg = document.createElement("div");
    loaderMsg.className = "msg bot loader-msg";
    loaderMsg.innerHTML = `
      <div class="loader-wrapper">
        <div class="loader"></div>
        <div id="loader-text">0%</div>
      </div>
    `;
    chat.appendChild(loaderMsg);
    chat.scrollTop = chat.scrollHeight;

    const loaderText = loaderMsg.querySelector("#loader-text");
    let percent = 0;

    let duration = 0;
    try {
      const audioUrl = URL.createObjectURL(file);
      const audio = new Audio(audioUrl);
      duration = await new Promise(res => { audio.onloadedmetadata = () => res(audio.duration); });
    } catch (e) {
      console.error("Não foi possível obter duração do áudio:", e);
    }

    const totalTime = Math.max(2000, duration * 4000);
    const stepTime = totalTime / 100;

    const interval = setInterval(() => {
      if (stopSignal.done) {
        clearInterval(interval);
        loaderText.textContent = "100%";
        // Troca para mensagem final
        setTimeout(() => {
          loaderMsg.textContent = "Transcrição concluída!";
        }, 800);
        resolve();
        return;
      }
      percent = Math.min(percent + 1, 99);
      loaderText.textContent = percent + "%";
      chat.scrollTop = chat.scrollHeight;
    }, stepTime);
  });
}


// ----------------- globals -----------------
const sendButton = document.getElementById("sendButton");
const sendSvg = sendButton.querySelector("svg");
let processing = false;

// guarda SVG original para restaurar depois
const originalSvgHTML = sendSvg.innerHTML;

// SVG simples de "stop" (quadrado). Ajuste viewBox se quiser.
const stopSvgHTML = `
  <circle cx="12" cy="12" r="12" fill="#ffffffff" opacity="0.2"></circle> <!-- círculo de fundo -->
  <rect x="6" y="6" width="12" height="12" rx="1.5" ry="1.5" fill="#ffffffff"></rect> <!-- stop -->
`;

// controlador compartilhado com simulateProgress
const stopSignal = { done: false };

// Quando clicar no botão: inicia envio se não estiver processando; se estiver, pede parada
sendButton.addEventListener("click", async (e) => {
  // evita o onclick inline duplo (se tiver)
  e.preventDefault();

  if (!processing) {
    // inicia envio
    await sendAudio();
  } else {
    // usuário pediu para parar: sinaliza frontend e backend
    stopSignal.done = true;                 // para o loader local
    try {
      // pede ao backend para interromper o processamento atual
      await fetch("/stop", { method: "POST" });
    } catch (err) {
      console.warn("Não foi possível contatar /stop:", err);
    }
    addMessage("Processamento interrompido pelo usuário.", "bot");
  }
});

// função utilitária para trocar ícone
function setSendIconIsProcessing(on) {
  processing = on;
  if (on) {
    // troca para stop
    sendSvg.innerHTML = stopSvgHTML;
    sendSvg.setAttribute('viewBox', '0 0 24 24'); // viewBox compatível com o quadrado

  } else {
    // restaura original
    sendSvg.innerHTML = originalSvgHTML;
    sendSvg.setAttribute('viewBox', '0 0 664 663'); // restaure se tiver mudado
  }
}


async function sendAudio() {
  const input = document.getElementById('file');
  if (!input.files[0]) return;
  const file = input.files[0];

  // Exibe mensagem do usuário com o nome do arquivo
  addMessage("Arquivo enviado: " + file.name, "user");

  // marca como processando (frontend)
  stopSignal.done = false;
  setSendIconIsProcessing(true);

  // Inicia simulação de progresso (ela observa stopSignal)
  const progressPromise = simulateProgress(file, stopSignal);

  const formData = new FormData();
  formData.append('audio', file);

  try {
    // envia ao backend
    const res = await fetch('/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      // backend devolveu erro HTTP
      throw new Error(`Erro HTTP: ${res.status}`);
    }

    // tenta ler resposta (pode ser texto parcial se trocou /stop)
    const data = await res.json();

    // sinaliza que frontend pode parar loader
    stopSignal.done = true;

    // espera a simulação finalizar com calma
    await progressPromise;

    // se o usuário clicou em stop antes do fim, data pode conter mensagem de interrupção
    const raw = (data && data.text) ? data.text.trim() : "";
    if (raw.length > 0) {
      const parts = raw.split('. ');
      const sentences = parts.map((s, idx) => {
        if (idx < parts.length - 1 || raw.endsWith('.')) return s.trim() + '.';
        return s.trim();
      }).filter(s => s.length > 0);
      displaySentences(sentences);
    } else {
      addMessage("Nenhum texto recebido do servidor.", "bot");
    }

    // limpa input só depois de tudo
    input.value = "";
    messageInput.value = "";
    messageInput.placeholder = "Message...";

  } catch (err) {
    console.error(err);
    stopSignal.done = true;
    addMessage("Erro ao enviar áudio.", "bot");
  } finally {
    // volta ícone pro normal
    setSendIconIsProcessing(false);
  }
}



// // simular envio + mensagens automáticas
// function simulateFakeLoading() {
//   const stopSignal = { done: false };

//   // Cria um arquivo fake só para passar na simulação
//   const fakeFile = new File([""], "teste.mp3", { type: "audio/mpeg" });

//   simulateProgress(fakeFile, stopSignal);

//   // Encerrar sozinho depois de alguns segundos
//   setTimeout(() => {
//     stopSignal.done = true;

//     // depois que acabar o loader, simula mensagens do bot
//     setTimeout(() => {
//       addMessage("Transcrição concluída!", "bot");

//       // mensagens de exemplo (pode trocar pelo que quiser)
//       const fakeSentences = [
//         "Olá, essa é uma transcrição de teste.",
//         "Estou simulando a resposta do servidor.",
//         "Assim você pode ver como fica no CSS."
//       ];

//       displaySentences(fakeSentences);
//     }, 1000);
//   }, 5000);
// }