// ===== Firebase (módulos ES via CDN) =====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, OAuthProvider, signInWithPopup, signOut, onAuthStateChanged }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, query, where, getDocs, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// TODO: copia aqui o firebaseConfig do TEU projeto (Project settings → Your apps → Web app).
// Este objeto pode ser público; NUNCA coloques Client Secret nem service-account.json.
const firebaseConfig = {
  apiKey: "AIzaSyBZ0jChLiVJwYxSCJ9Bnqz-6dmT-xHMfdE",
  authDomain: "epbjc-749d4.firebaseapp.com",
  projectId: "epbjc-749d4",
  storageBucket: "epbjc-749d4.firebasestorage.app",
  messagingSenderId: "146128884733",
  appId: "1:146128884733:web:b9d10659c8ec6a7046bf94",
  measurementId: "G-GPL520L8LL"
};
const DOMINIO = "@alunos.epbjc.pt";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const provider = new OAuthProvider("microsoft.com");
provider.setCustomParameters({ prompt: "select_account" });

const $ = (id) => document.getElementById(id);

function mensagem(texto, tipo = "") {
  const m = $("msg");
  m.textContent = texto;
  m.className = tipo;
  m.hidden = !texto;
}

// ===== Login / logout =====
$("btnEntrar").addEventListener("click", async () => {
  mensagem("");
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error(e);
    mensagem("Não foi possível iniciar sessão (" + (e.code || "erro") + "). Verifica se os popups estão permitidos.", "erro");
  }
});
$("btnSair").addEventListener("click", () => signOut(auth));

// ===== Estado de autenticação =====
onAuthStateChanged(auth, async (user) => {
  const email = user?.email?.toLowerCase() ?? "";
  if (user && !email.endsWith(DOMINIO)) {
    await signOut(auth);
    mensagem("Usa a conta institucional " + DOMINIO, "erro");
    return;
  }
  $("login").hidden = !!user;
  $("area").hidden = !user;
  $("sessao").hidden = !user;
  if (user) {
    $("nome").textContent = user.displayName || email;
    $("dataPedido").value = new Date().toISOString().slice(0, 10);
    carregarPedidos(user);
  } else {
    $("lista").innerHTML = "";
  }
});

// ===== Criar pedido =====
$("formPedido").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const user = auth.currentUser;
  if (!user) return;
  const equipamento = $("equipamento").value;
  const dataPedido = $("dataPedido").value;
  const devolucao = $("devolucao").value;

  if (!equipamento || !dataPedido || !devolucao) return mensagem("Preenche todos os campos obrigatórios.", "erro");
  if (devolucao < dataPedido) return mensagem("A devolução não pode ser anterior à data do pedido.", "erro");

  const codigo = "REQ-" + dataPedido.replaceAll("-", "") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const btn = ev.submitter; btn.disabled = true;
  try {
    await addDoc(collection(db, "requisicoes"), {
      codigo,
      uid: user.uid,
      requisitante: user.displayName || "",
      email: user.email.toLowerCase(),
      equipamento,
      dataPedido,
      devolucaoPrevista: devolucao,
      estado: "Pendente",
      observacoes: $("obs").value.trim().slice(0, 500),
      criadoEm: serverTimestamp()
    });
    ev.target.reset();
    $("dataPedido").value = new Date().toISOString().slice(0, 10);
    mensagem("Pedido " + codigo + " enviado.", "ok");
    carregarPedidos(user);
  } catch (e) {
    console.error(e);
    mensagem("Não foi possível enviar o pedido (" + (e.code || "erro") + ").", "erro");
  } finally {
    btn.disabled = false;
  }
});

// ===== Listar os meus pedidos (query filtrada por uid, exigida pelas regras) =====
async function carregarPedidos(user) {
  try {
    const q = query(collection(db, "requisicoes"), where("uid", "==", user.uid));
    const snap = await getDocs(q);
    const pedidos = snap.docs.map((d) => d.data())
      .sort((a, b) => (b.criadoEm?.seconds ?? 0) - (a.criadoEm?.seconds ?? 0)); // ordena no cliente: evita criar índice composto
    const corpo = $("lista");
    corpo.innerHTML = "";
    $("vazio").hidden = pedidos.length > 0;
    for (const p of pedidos) {
      const tr = document.createElement("tr");
      [p.codigo, p.equipamento, p.dataPedido, p.devolucaoPrevista, p.estado].forEach((v, i) => {
        const td = document.createElement("td");
        td.textContent = v ?? "";               // textContent evita injeção de HTML
        if (i === 4) td.className = "estado " + v;
        tr.appendChild(td);
      });
      corpo.appendChild(tr);
    }
  } catch (e) {
    console.error(e);
    mensagem("Não foi possível carregar os pedidos (" + (e.code || "erro") + ").", "erro");
  }
}
