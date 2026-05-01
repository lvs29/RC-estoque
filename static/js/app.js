async function renderPecas(pecas) {
    const grid = document.querySelector(".card-grid");
    grid.innerHTML = "";

    if (usuarioAtual?.role === "admin") {
        const card = document.createElement("div");
        card.className = "card add-card";
        card.addEventListener("click", () => { addPecaPopup(); });
        card.innerHTML = `
            <img src="/static/img/add.svg" alt="add icon">
            <p class="nome">Adicionar peça nova</p>
        `;
        grid.appendChild(card);
    }

    pecas.forEach(peca => {
        const card = document.createElement("div");
        card.className = "card";
        let isOut = (peca.quantidade < 1)
        if (isOut) {card.classList.add("out-of")}
        card.innerHTML = `
            <img 
                src="${peca.foto_path || '/static/img/placeholder.svg'}" 
                alt="foto da peça"
                onerror="this.src='/static/img/placeholder.svg'; this.onerror=null;"
            >
            <div class="quantity-box">
                <p>Qtd: ${peca.quantidade}</p>
            </div>
            <p class="nome">${peca.nome}</p>
            <p class="desc">${peca.descricao}</p>
            <button class="add" ${isOut ? "disabled" : ""}>${isOut ? "Sem estoque" : "Adicionar +"}</button>
        `;
        grid.appendChild(card);
    });
}

function addPecaPopup() {
    const overlay = document.createElement("div");
    overlay.id = "popup-overlay";

    const popup = document.createElement("div");
    popup.id = "popup";

    popup.innerHTML = `
        <h2>Adicionar peça</h2>

        <input id="criar-peca-nome" type="text" placeholder="Nome *">
        <textarea id="criar-peca-descricao" placeholder="Descrição" rows="3"></textarea>
        <input id="criar-peca-quantidade" type="number" placeholder="Quantidade" min="0">
        <input id="criar-peca-foto" type="file" accept="image/*">

        <div class="popup-actions">
            <button id="popup-cancelar">Cancelar</button>
            <button id="popup-salvar">Salvar</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const fechar = () => document.body.removeChild(overlay);

    document.getElementById("popup-cancelar").addEventListener("click", fechar);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) fechar(); });

    document.getElementById("popup-salvar").addEventListener("click", async () => {
        await criarPeca();
        fechar();
        const res = await listarPecas();
        renderPecas(res.data)
    });
}

function getNavItems(role) {
    const base = [
        { label: "Home", href: "/", icon: "fa-solid fa-house" },
    ];

    const comLogin = [
        ...base,
        { label: "Reservas", href: "/reservas", icon: "fa-solid fa-calendar-check" },
        { label: "Perfil",   href: "/perfil",   icon: "fa-solid fa-user" },
        { label: "Logout",   href: "/login?logout",   icon: "fa-solid fa-right-to-bracket" },
    ];

    const admin = [
        ...comLogin,
        { label: "Gerenciamento", href: "/manage", icon: "fa-solid fa-screwdriver-wrench" },
    ];

    if (role === "admin") return admin;
    if (role === "user")  return comLogin;
    return [...base, { label: "Login", href: "/login", icon: "fa-solid fa-right-to-bracket" }];
}

function renderNav() {
    const nav = document.querySelector("nav");
    const items = getNavItems(usuarioAtual?.role);
    nav.innerHTML = items
        .map(item => `<a href="${item.href}"><i class="${item.icon}"></i> ${item.label}</a>`)
        .join("");
}

const output = document.getElementById("output");
let TOKEN = localStorage.getItem("token") || null;

function renderUsuarios(users) {
    const tbody = document.getElementById("usuarios-tabela");
    tbody.innerHTML = users.map(u => `
      <tr>
        <td>${u.id}</td>
        <td>${u.nome}</td>
        <td>${u.username}</td>
        <td>${u.role}</td>
        <td class="action-cell">
          <button type="button" onclick="handleDeleteUsuario(${u.id})">Excluir</button>
        </td>
      </tr>
    `).join("");
}

function renderPecasAdmin(pecas) {
    const tbody = document.getElementById("pecas-tabela");
    tbody.innerHTML = pecas.map(p => `
      <tr>
        <td>${p.id}</td>
        <td>${p.nome}</td>
        <td>${p.quantidade}</td>
        <td>${p.descricao || "—"}</td>
        <td class="action-cell">
          <button type="button" onclick="handleDeletePeca(${p.id})">Excluir</button>
        </td>
      </tr>
    `).join("");
}

function renderReservas(reservas) {
    const tbody = document.getElementById("reservas-tabela");
    tbody.innerHTML = reservas.map(r => `
      <tr>
        <td>${r.id}</td>
        <td>${r.peca_nome || r.peca_id}</td>
        <td>${r.solicitante}</td>
        <td>${r.data_retirada}</td>
        <td>${r.data_devolucao || "—"}</td>
        <td>${r.quantidade}</td>
        <td>${r.devolvido ? "Devolvido" : r.retirado ? "Retirado" : "Pendente"}</td>
      </tr>
    `).join("");
}

async function loadUsuarios() {
    const res = await listarUsuarios();
    if (res.status === 200) renderUsuarios(res.data);
}

async function loadPecas() {
    const res = await listarPecas();
    if (res.status === 200) renderPecasAdmin(res.data);
}

async function loadReservas() {
    const res = await listarReservas();
    if (res.status === 200) renderReservas(res.data);
}

async function handleDeleteUsuario(id) {
    if (!confirm(`Excluir usuário ${id}?`)) return;
    await req("DELETE", `/api/usuarios/${id}`);
    await loadUsuarios();
}

async function handleDeletePeca(id) {
    if (!confirm(`Excluir peça ${id}?`)) return;
    await req("DELETE", `/api/pecas/${id}`);
    await loadPecas();
}

async function initManagePage() {
    await Promise.all([loadUsuarios(), loadPecas(), loadReservas()]);

    document.getElementById("criar-usuario-btn").addEventListener("click", async (event) => {
        event.preventDefault();
        await criarUsuario();
        await loadUsuarios();
    });

    document.getElementById("criar-peca-btn").addEventListener("click", async (event) => {
        event.preventDefault();
        await criarPeca();
        await loadPecas();
    });
}

async function initProfilePage() {
    // Load current user data
    const nomeInput = document.getElementById("profile-nome");
    const usernameInput = document.getElementById("profile-username");
    const senhaAtualInput = document.getElementById("profile-senha-atual");
    const senhaNovaInput = document.getElementById("profile-senha-nova");
    const senhaConfirmaInput = document.getElementById("profile-senha-confirma");

    nomeInput.value = usuarioAtual.nome;
    usernameInput.value = usuarioAtual.username;

    // Handle form submit
    document.getElementById("profile-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const nome = nomeInput.value.trim();
        const username = usernameInput.value.trim();
        const senhaAtual = senhaAtualInput.value;
        const senhaNova = senhaNovaInput.value;
        const senhaConfirma = senhaConfirmaInput.value;

        if (!nome || !username) {
            alert("Nome e username são obrigatórios");
            return;
        }

        // Validate password change
        if (senhaNova || senhaConfirma) {
            if (!senhaAtual) {
                alert("Senha atual é obrigatória para mudar a senha");
                return;
            }
            if (!senhaNova) {
                alert("Digite a nova senha");
                return;
            }
            if (senhaNova !== senhaConfirma) {
                alert("As senhas não coincidem");
                return;
            }
        }

        const updateData = { nome, username };
        if (senhaNova) {
            updateData.senha = senhaNova;
            updateData.senha_atual = senhaAtual;
        }

        try {
            const res = await req("PUT", "/api/auth/me", updateData);
            if (res.status === 200) {
                alert("Perfil atualizado com sucesso!");
                // Clear password fields
                senhaAtualInput.value = "";
                senhaNovaInput.value = "";
                senhaConfirmaInput.value = "";
                // Update global usuarioAtual
                usuarioAtual = res.data;
                renderNav();
            } else {
                alert(res.data.erro || "Erro ao atualizar perfil");
            }
        } catch (err) {
            alert(err.message);
        }
    });
}

document.addEventListener("DOMContentLoaded", async () => {
    await restaurarSessao();
    renderNav();
    if (document.getElementsByClassName("card-grid").length > 0) {
        const res = await listarPecas();
        if (res.status === 200) renderPecas(res.data);
    }
    if (document.getElementById("usuario-display")) {
        document.getElementById("usuario-display").textContent = usuarioAtual.nome;
        document.getElementById("role-display").textContent = usuarioAtual.role;
    }
    if (document.getElementById("usuarios-tabela")) {
        await initManagePage();
    }
    if (document.getElementById("profile-form")) {
        await initProfilePage();
    }
});
