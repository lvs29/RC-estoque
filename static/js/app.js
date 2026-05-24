let pecas = [];
let searchInput;
let buttons;

async function renderPecas(pecas) {
    let eletronicosCor = "#db3a2e";
    let legosCor = "#ffce3b";
    let computadoresCor = "#4489d3";
    let diversosCor = "#9eff86";

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
        const isOut = (peca.quantidade < 1);
        if (isOut) card.classList.add("out-of");

        const accentColor = peca.tipo === "Eletrônicos" ? eletronicosCor
            : peca.tipo === "Legos"        ? legosCor
            : peca.tipo === "Computadores" ? computadoresCor
            : diversosCor;

        card.innerHTML = `
            <img
                src="${peca.foto_path || '/static/img/placeholder.svg'}"
                alt="foto da peça"
                onerror="this.src='/static/img/placeholder.svg'; this.onerror=null;"
            >
            <div class="quantity-box">
                <p class="peca-quantidade"></p>
            </div>
            <p class="nome" id="peca-nome"></p>
            <p class="desc" id="peca-descricao"></p>
            <p class="tipo" style="--accent: ${accentColor};"></p>
            <button class="add" ${isOut ? "disabled" : ""}>${isOut ? "Sem estoque" : "Adicionar +"}</button>
        `;

        card.querySelector(".peca-quantidade").textContent = `Qtd: ${peca.quantidade}`;
        card.querySelector("#peca-nome").textContent       = peca.nome || "";
        card.querySelector("#peca-descricao").textContent  = peca.descricao || "";
        card.querySelector(".tipo").textContent            = peca.tipo || "";

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
    data_prevista_devolucao: null,
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
        <h3></h3>
        <p class="peca-disponivel"></p>

        <label>Quantidade *</label>
        <input type="number" id="cart-qty" min="1" max="${peca.quantidade}" value="1">

        <div class="add-cart-buttons">
            <button id="cart-cancel" class="add-cart-cancel">Cancelar</button>
            <button id="cart-add" class="add-cart-confirm">Adicionar ao carrinho</button>
        </div>
    `;

    popup.querySelector("h3").textContent              = peca.nome;
    popup.querySelector(".peca-disponivel").textContent = `Disponível: ${peca.quantidade} unidades`;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    popup.querySelector("#cart-cancel").addEventListener("click", () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    });

    popup.querySelector("#cart-add").addEventListener("click", () => {
        const quantidade = parseInt(popup.querySelector("#cart-qty").value);
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
    const container  = document.getElementById("cart-container");
    const count      = document.getElementById("cart-count");
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

    if (carrinhoReserva.itens.length === 0) return;

    const overlay = document.createElement("div");
    overlay.className = "cart-modal-overlay";

    const modal = document.createElement("div");
    modal.className = "cart-modal";

    modal.innerHTML = `
        <h2>Resumo da Reserva</h2>
        <div class="cart-modal-items"></div>

        <label>Data de Retirada *</label>
        <input type="date" id="modal-retirada" value="${carrinhoReserva.data_retirada || ''}">

        <label>Data de Devolução *</label>
        <input type="date" id="modal-devolucao" value="${carrinhoReserva.data_prevista_devolucao || ''}">

        <label>Observações</label>
        <textarea id="modal-obs" placeholder="Adicione observações..."></textarea>

        <div class="cart-modal-actions">
            <button id="modal-cancel" class="cart-modal-cancel">Voltar</button>
            <button id="modal-confirm" class="cart-modal-confirm">Confirmar Reserva</button>
        </div>
    `;

    modal.querySelector("#modal-obs").textContent = carrinhoReserva.observacoes || "";

    // itens com createElement
    const itemsContainer = modal.querySelector(".cart-modal-items");
    carrinhoReserva.itens.forEach(item => {
        const div  = document.createElement("div");
        div.className = "cart-item";

        const info = document.createElement("div");
        info.className = "cart-item-info";

        const nome = document.createElement("p");
        nome.className   = "cart-item-name";
        nome.textContent = item.peca_nome;

        const qty = document.createElement("p");
        qty.className   = "cart-item-qty";
        qty.textContent = `Qtd: ${item.quantidade}`;

        const btn = document.createElement("button");
        btn.className   = "cart-item-remove";
        btn.textContent = "Remover";
        btn.addEventListener("click", () => {
            removeFromCart(item.peca_id);
            overlay.remove();
            setTimeout(openCartModal, 100);
        });

        info.appendChild(nome);
        info.appendChild(qty);
        div.appendChild(info);
        div.appendChild(btn);
        itemsContainer.appendChild(div);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    modal.querySelector("#modal-cancel").addEventListener("click", () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    });

    modal.querySelector("#modal-confirm").addEventListener("click", async () => {
        const data_retirada  = modal.querySelector("#modal-retirada").value;
        const data_devolucao = modal.querySelector("#modal-devolucao").value;
        const observacoes    = modal.querySelector("#modal-obs").value;

        if (!data_retirada || !data_devolucao) {
            showMessagePopup("Datas de retirada e devolução são obrigatórias", true);
            return;
        }

        carrinhoReserva.data_retirada           = data_retirada;
        carrinhoReserva.data_prevista_devolucao = data_devolucao;
        carrinhoReserva.observacoes             = observacoes;

        await confirmarReserva();
        document.body.removeChild(overlay);
    });
}

async function confirmarReserva() {
    const body = {
        itens:                   carrinhoReserva.itens,
        data_retirada:           carrinhoReserva.data_retirada,
        data_prevista_devolucao: carrinhoReserva.data_prevista_devolucao,
    };
    if (carrinhoReserva.observacoes.trim()) {
        body.observacoes = carrinhoReserva.observacoes;
    }

    const { status, data } = await criarReservaComBody(body);
    if (status === 201) {
        showMessagePopup("Reserva confirmada com sucesso!");
        carrinhoReserva = { itens: [], data_retirada: null, data_prevista_devolucao: null, observacoes: "" };
        updateCartUI();
    } else {
        let msg = data.erro || data.description || "Erro ao criar reserva";
        if (data.proxima_disponibilidade) {
            const fmt = new Date(data.proxima_disponibilidade + "T00:00:00").toLocaleDateString("pt-BR");
            msg += `\n\nEstoque disponível a partir de ${fmt}.`;
        }
        showMessagePopup(msg, true);
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
        <select id="criar-peca-tipo">
            <option value="">Tipo</option>
            <option value="Eletrônicos">Eletrônicos</option>
            <option value="Legos">Legos</option>
            <option value="Computadores">Computadores</option>
            <option value="Diversos">Diversos</option>
        </select>

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
        renderPecas(res.data);
    });
}

function getNavItems(role) {
    const base = [
        { label: "Home", href: "/", icon: "fa-solid fa-house" },
    ];

    const comLogin = [
        ...base,
        { label: "Reservas", href: "/reservas",    icon: "fa-solid fa-calendar-check" },
        { label: "Perfil",   href: "/perfil",       icon: "fa-solid fa-user" },
        { label: "Logout",   href: "/login?logout", icon: "fa-solid fa-right-to-bracket" },
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
    const nav   = document.querySelector("nav");
    const items = getNavItems(usuarioAtual?.role);
    nav.innerHTML = items
        .map(item => `<a href="${item.href}"><i class="${item.icon}"></i> ${item.label}</a>`)
        .join("");

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
        <tr data-usuario-id="${u.id}">
            <td>${u.id}</td>
            <td class="usuario-nome"></td>
            <td class="usuario-username"></td>
            <td><select>
                <option value="user"  ${u.role === "user"  ? "selected" : ""}>Usuário</option>
                <option value="admin" ${u.role === "admin" ? "selected" : ""}>Administrador</option>
            </select></td>
            <td class="action-cell">
                <button type="button" onclick="handleDeleteUsuario(${u.id})">Excluir</button>
                <button type="button" onclick="atualizarUsuario(${u.id})" class="save-btn">Salvar</button>
            </td>
        </tr>
    `).join("");

    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, index) => {
        const u = users[index];
        row.querySelector(".usuario-nome").textContent     = u.nome;
        row.querySelector(".usuario-username").textContent = u.username;
    });
}

function renderPecasAdmin(pecas) {
    const tbody = document.getElementById("pecas-tabela");
    tbody.innerHTML = pecas.map(p => `
        <tr data-peca-id="${p.id}">
            <td>${p.id}</td>
            <td><input type="text" class="peca-nome"></td>
            <td><input type="number" value="${p.quantidade_total || p.quantidade}" min="0"></td>
            <td>${p.quantidade_reservada || 0}</td>
            <td>${p.quantidade}</td>
            <td><input type="text" class="peca-descricao"></td>
            <td class="action-cell">
                <button type="button" onclick="handleDeletePeca(${p.id})">Excluir</button>
                <button type="button" onclick="atualizarPeca(${p.id})" class="save-btn">Salvar</button>
            </td>
        </tr>
    `).join("");

    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, index) => {
        const p = pecas[index];
        row.querySelector(".peca-nome").value      = p.nome;
        row.querySelector(".peca-descricao").value = p.descricao || "—";
    });
}

function renderReservas(reservas) {
    const tbody = document.getElementById("reservas-tabela");
    tbody.innerHTML = reservas.map(r => `
        <tr>
            <td>${r.id}</td>
            <td class="reserva-itens"></td>
            <td class="reserva-solicitante"></td>
            <td>${r.data_retirada}</td>
            <td>${r.data_prevista_devolucao || "—"}</td>
            <td class="reserva-quantidade"></td>
            <td>${r.devolvido ? "Devolvido" : r.retirado ? "Retirado" : "Pendente"}</td>
        </tr>
    `).join("");

    const rows = tbody.querySelectorAll("tr");
    rows.forEach((row, index) => {
        const r        = reservas[index];
        const itensStr = r.itens.map(item => `${item.peca_nome} (x${item.quantidade})`).join(", ");
        row.querySelector(".reserva-itens").textContent       = itensStr;
        row.querySelector(".reserva-solicitante").textContent = r.solicitante;
        row.querySelector(".reserva-quantidade").textContent  = r.itens.reduce((sum, item) => sum + item.quantidade, 0);
    });
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
    await deletarUsuarioPorId(id);
    await loadUsuarios();
}

async function atualizarUsuario(id) {
    const row = document.querySelector(`#usuarios-tabela tr[data-usuario-id="${id}"]`);
    if (!row) return showMessagePopup("Linha não encontrada", true);
    const role = row.querySelector("td:nth-child(4) select").value;
    await atualizarUsuarioPorId(id, { role });
    await loadUsuarios();
}

async function handleDeletePeca(id) {
    if (!confirm(`Excluir peça ${id}?`)) return;
    await deletarPecaPorId(id);
    await loadPecas();
}

async function atualizarPeca(id) {
    const row = document.querySelector(`#pecas-tabela tr[data-peca-id="${id}"]`);
    if (!row) return showMessagePopup("Linha não encontrada", true);
    const nome             = row.querySelector("td:nth-child(2) input").value.trim();
    const quantidade_total = row.querySelector("td:nth-child(3) input").value;
    const descricao        = row.querySelector("td:nth-child(6) input").value.trim();
    if (!nome) return showMessagePopup("Nome é obrigatório", true);
    await atualizarPecaPorId(id, {
        nome,
        quantidade_total: parseInt(quantidade_total) || 0,
        descricao
    });
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
    const nomeInput          = document.getElementById("profile-nome");
    const usernameInput      = document.getElementById("profile-username");
    const senhaAtualInput    = document.getElementById("profile-senha-atual");
    const senhaNovaInput     = document.getElementById("profile-senha-nova");
    const senhaConfirmaInput = document.getElementById("profile-senha-confirma");

    nomeInput.value     = usuarioAtual.nome;
    usernameInput.value = usuarioAtual.username;

    document.getElementById("profile-form").addEventListener("submit", async (event) => {
        event.preventDefault();
        const nome          = nomeInput.value.trim();
        const username      = usernameInput.value.trim();
        const senhaAtual    = senhaAtualInput.value;
        const senhaNova     = senhaNovaInput.value;
        const senhaConfirma = senhaConfirmaInput.value;

        if (!nome || !username) {
            showMessagePopup("Nome e username são obrigatórios", true);
            return;
        }

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
            updateData.senha       = senhaNova;
            updateData.senha_atual = senhaAtual;
        }

        try {
            const res = await atualizarPerfil(updateData);
            if (res.status === 200) {
                showMessagePopup("Perfil atualizado com sucesso!");
                senhaAtualInput.value    = "";
                senhaNovaInput.value     = "";
                senhaConfirmaInput.value = "";
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

    const p = document.createElement("p");
    p.textContent = msg;

    const btn = document.createElement("button");
    btn.id          = "message-popup-close";
    btn.textContent = "OK";

    popup.appendChild(p);
    popup.appendChild(btn);
    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    btn.addEventListener("click", () => {
        document.body.removeChild(overlay);
    });

    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) document.body.removeChild(overlay);
    });
}

function initSearch() {
    searchInput = document.querySelector(".search-bar input");
    if (!searchInput) return;

    searchInput.addEventListener("input", () => {
        const query    = searchInput.value.trim().toLowerCase();
        const filtered = pecas.filter(peca =>
            peca.nome.toLowerCase().includes(query) ||
            peca.descricao.toLowerCase().includes(query)
        );
        renderPecas(filtered);
        updateClearButton();
    });
}

function initSearchByType() {
    const tipoDiv = document.querySelector(".tipo-div");
    if (!tipoDiv) return;

    buttons = document.querySelectorAll(".tipo-div button");

    const clearBtn = document.createElement("button");
    clearBtn.innerHTML     = '<i class="fa-solid fa-xmark"></i>';
    clearBtn.className     = "clear-btn";
    clearBtn.style.display = "none";
    tipoDiv.insertBefore(clearBtn, tipoDiv.firstChild);

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const tipo = button.textContent.trim();
            buttons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");
            renderPecas(pecas.filter(p => p.tipo === tipo));
            updateClearButton();
        });
    });

    clearBtn.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        buttons.forEach(btn => btn.classList.remove("active"));
        renderPecas(pecas);
        updateClearButton();
    });
}

function updateClearButton() {
    const clearBtn = document.querySelector(".clear-btn");
    if (!clearBtn) return;
    const hasActiveType = Array.from(buttons).some(btn => btn.classList.contains("active"));
    const hasQuery      = searchInput && searchInput.value.trim();
    clearBtn.style.display = (hasActiveType || hasQuery) ? "inline-block" : "none";
}

document.addEventListener("DOMContentLoaded", async () => {
    await restaurarSessao();
    renderNav();

    if (document.getElementsByClassName("card-grid").length > 0) {
        const res = await listarPecas();
        if (res.status === 200) {
            pecas = res.data;
            renderPecas(pecas);
        }
    }

    if (document.getElementById("usuario-display")) {
        document.getElementById("usuario-display").textContent = usuarioAtual.nome;
        document.getElementById("role-display").textContent    = usuarioAtual.role;
    }

    if (document.getElementById("usuarios-tabela")) {
        await initManagePage();
    }

    if (document.getElementById("profile-form")) {
        await initProfilePage();
    }

    await initSearch();
    initSearchByType();

    const cartBtn = document.getElementById("cart-btn");
    if (cartBtn) {
        cartBtn.addEventListener("click", openCartModal);
    }
});