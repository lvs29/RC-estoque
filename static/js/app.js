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
            <button class="add" ${isOut ? "disabled" : ""} data-peca-id="${peca.id}" data-peca-nome="${peca.nome}">${isOut ? "Sem estoque" : "Adicionar +"}</button>
        `;
        grid.appendChild(card);
        
        const btn = card.querySelector(".add");
        if (!isOut) {
            btn.addEventListener("click", () => openAddToCartPopup(peca));
        }
    });
}

// ─── Cart (Carrinho de Reservas) ────────────────────────────────────────────

let carrinhoReserva = {
    itens: [],
    data_retirada: null,
    data_devolucao: null,
    observacoes: ""
};

function openAddToCartPopup(peca) {
    if (!usuarioAtual) {
        showMessagePopup("Você precisa estar logado para fazer reservas", true);
        return;
    }
    
    const overlay = document.createElement("div");
    overlay.className = "add-cart-overlay";

    const popup = document.createElement("div");
    popup.className = "add-cart-popup";

    popup.innerHTML = `
        <h3>${peca.nome}</h3>
        <p>Disponível: ${peca.quantidade} unidades</p>
        
        <label>Quantidade *</label>
        <input type="number" id="cart-qty" min="1" max="${peca.quantidade}" value="1">

        <div class="add-cart-buttons">
            <button id="cart-cancel" class="add-cart-cancel">Cancelar</button>
            <button id="cart-add" class="add-cart-confirm">Adicionar ao carrinho</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById("cart-cancel").addEventListener("click", () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    });

    document.getElementById("cart-add").addEventListener("click", () => {
        const quantidade = parseInt(document.getElementById("cart-qty").value);
        if (quantidade < 1 || quantidade > peca.quantidade) {
            showMessagePopup("Quantidade inválida", true);
            return;
        }
        addToCart(peca.id, peca.nome, quantidade);
        document.body.removeChild(overlay);
    });
}

function addToCart(peca_id, peca_nome, quantidade) {
    const existente = carrinhoReserva.itens.find(item => item.peca_id === peca_id);
    if (existente) {
        existente.quantidade += quantidade;
    } else {
        carrinhoReserva.itens.push({ peca_id, peca_nome, quantidade });
    }
    updateCartUI();
    showMessagePopup(`${peca_nome} adicionado ao carrinho!`);
}

function removeFromCart(peca_id) {
    carrinhoReserva.itens = carrinhoReserva.itens.filter(item => item.peca_id !== peca_id);
    updateCartUI();
}

function updateCartUI() {
    const container = document.getElementById("cart-container");
    const count = document.getElementById("cart-count");
    const totalItens = carrinhoReserva.itens.reduce((sum, item) => sum + item.quantidade, 0);
    
    if (totalItens > 0) {
        container.style.display = "flex";
        count.textContent = totalItens;
    } else {
        container.style.display = "none";
    }
}

function openCartModal() {
    if (!usuarioAtual) {
        showMessagePopup("Você precisa estar logado para reservar", true);
        return;
    }
    
    if (carrinhoReserva.itens.length === 0) {
        return;
    }
    
    const overlay = document.createElement("div");
    overlay.className = "cart-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "cart-modal";

    const itensHTML = carrinhoReserva.itens.map((item, idx) => `
        <div class="cart-item">
            <div class="cart-item-info">
                <p class="cart-item-name">${item.peca_nome}</p>
                <p class="cart-item-qty">Qtd: ${item.quantidade}</p>
            </div>
            <button onclick="removeFromCart(${item.peca_id}); document.querySelector('.cart-modal-overlay').parentNode.removeChild(document.querySelector('.cart-modal-overlay')); setTimeout(openCartModal, 100);" class="cart-item-remove">Remover</button>
        </div>
    `).join("");

    modal.innerHTML = `
        <h2>Resumo da Reserva</h2>
        <div class="cart-modal-items">
            ${itensHTML}
        </div>

        <label>Data de Retirada *</label>
        <input type="date" id="modal-retirada" value="${carrinhoReserva.data_retirada || ''}">

        <label>Data de Devolução *</label>
        <input type="date" id="modal-devolucao" value="${carrinhoReserva.data_devolucao || ''}">

        <label>Observações</label>
        <textarea id="modal-obs" placeholder="Adicione observações...">${carrinhoReserva.observacoes}</textarea>

        <div class="cart-modal-actions">
            <button id="modal-cancel" class="cart-modal-cancel">Voltar</button>
            <button id="modal-confirm" class="cart-modal-confirm">Confirmar Reserva</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    document.getElementById("modal-cancel").addEventListener("click", () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    });

    document.getElementById("modal-confirm").addEventListener("click", async () => {
        const data_retirada = document.getElementById("modal-retirada").value;
        const data_devolucao = document.getElementById("modal-devolucao").value;
        const observacoes = document.getElementById("modal-obs").value;

        if (!data_retirada || !data_devolucao) {
            showMessagePopup("Datas de retirada e devolução são obrigatórias", true);
            return;
        }

        carrinhoReserva.data_retirada = data_retirada;
        carrinhoReserva.data_devolucao = data_devolucao;
        carrinhoReserva.observacoes = observacoes;

        await confirmarReserva();
        document.body.removeChild(overlay);
    });
}

async function confirmarReserva() {
    const body = {
        itens: carrinhoReserva.itens,
        data_retirada: carrinhoReserva.data_retirada,
        data_devolucao: carrinhoReserva.data_devolucao,
    };
    if (carrinhoReserva.observacoes.trim()) {
        body.observacoes = carrinhoReserva.observacoes;
    }

    const { status, data } = await req("POST", "/api/reservas", body);
    if (status === 201) {
        showMessagePopup("Reserva confirmada com sucesso!");
        carrinhoReserva = { itens: [], data_retirada: null, data_devolucao: null, observacoes: "" };
        updateCartUI();
    } else {
        let msg = data.erro || data.description || "Erro ao criar reserva";
        if (data.proxima_disponibilidade) {
            const fmt = new Date(data.proxima_disponibilidade + "T00:00:00")
                .toLocaleDateString("pt-BR");
            msg += `\n\nEstoque disponível a partir de ${fmt}.`;
        }
        showMessagePopup(msg, true);  // usa msg, não data.description diretamente
    }
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
    
    // Show/hide cart container based on login status
    const cartContainer = document.getElementById("cart-container");
    if (usuarioAtual && cartContainer) {
        if (carrinhoReserva.itens.length > 0) {
            cartContainer.style.display = "flex";
        }
    }
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
    tbody.innerHTML = reservas.map(r => {
        const itensStr = r.itens.map(item => `${item.peca_nome} (x${item.quantidade})`).join(", ");
        return `
      <tr>
        <td>${r.id}</td>
        <td>${itensStr}</td>
        <td>${r.solicitante}</td>
        <td>${r.data_retirada}</td>
        <td>${r.data_devolucao || "—"}</td>
        <td>${r.itens.reduce((sum, item) => sum + item.quantidade, 0)}</td>
        <td>${r.devolvido ? "Devolvido" : r.retirado ? "Retirado" : "Pendente"}</td>
      </tr>
    `}).join("");
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
            showMessagePopup("Nome e username são obrigatórios", true);
            return;
        }

        // Validate password change
        if (senhaNova || senhaConfirma) {
            if (!senhaAtual) {
                showMessagePopup("Senha atual é obrigatória para mudar a senha", true);
                return;
            }
            if (!senhaNova) {
                showMessagePopup("Digite a nova senha", true);
                return;
            }
            if (senhaNova !== senhaConfirma) {
                showMessagePopup("As senhas não coincidem", true);
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
                showMessagePopup("Perfil atualizado com sucesso!");
                // Clear password fields
                senhaAtualInput.value = "";
                senhaNovaInput.value = "";
                senhaConfirmaInput.value = "";
                // Update global usuarioAtual
                usuarioAtual = res.data;
                renderNav();
            } else {
                showMessagePopup(res.data.erro || "Erro ao atualizar perfil", true);
            }
        } catch (err) {
            showMessagePopup(err.message, true);
        }
    });
}

function showMessagePopup(msg, isError = false) {
    const overlay = document.createElement("div");
    overlay.className = "message-popup-overlay";

    const popup = document.createElement("div");
    popup.className = "message-popup" + (isError ? " error" : "");

    popup.innerHTML = `
        <p>${msg}</p>
        <button id="message-popup-close">OK</button>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    document.getElementById("message-popup-close").addEventListener("click", () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
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
    
    // Cart button listener
    const cartBtn = document.getElementById("cart-btn");
    if (cartBtn) {
        cartBtn.addEventListener("click", openCartModal);
    }
});
