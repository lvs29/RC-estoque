// ─── Helpers ───────────────────────────────────────────────────────────────

function v(id) {
    return document.getElementById(id).value;
}

async function req(method, url, body = null, isForm = false) {
    const opts = {
        method,
        headers: {},
        credentials: "include", // envia/recebe cookies automaticamente
    };

    if (body) {
        if (isForm) {
            opts.body = body;
        } else {
            opts.headers["Content-Type"] = "application/json";
            opts.body = JSON.stringify(body);
        }
    }

    const res = await fetch(url, opts);

    if (!res.ok && res.status !== 401 && res.status !== 409 && res.status !== 400) {
        const json = await res.json().catch(() => ({}));
        throw Object.assign(new Error(json.mensagem || "Erro desconhecido"), { status: res.status });
    }
    return { status: res.status, data: await res.json().catch(() => ({})) };
}

// ─── Auth ──────────────────────────────────────────────────────────────────

let usuarioAtual = null;

async function restaurarSessao() {
    try {
        const { status, data } = await req("GET", "/api/auth/me");
        if (status === 200) {
            usuarioAtual = data; // { nome, role, ... }
        }
    } catch (err) {
        if (err.status !== 401) console.error("Erro ao restaurar sessão:", err);
    }
}

async function fazerLogin() {
    const username = v("login-username");
    const senha = v("login-senha");

    if (!username || !senha) return showMessagePopup("Preencha username e senha", true);

    try {
        const { status, data } = await req("POST", "/api/auth/login", { username, senha });

        if (status === 200) {
            window.location.href = "/";
        } else {
            showMessagePopup(data.mensagem || "Credenciais inválidas", true);
        }
    } catch (err) {
        showMessagePopup(err.message, true);
    }
}

async function fazerLogout() {
    await req("POST", "/api/auth/logout");
    // o servidor apaga o cookie; redireciona para login
    window.location.href = "/login";
}

async function atualizarPerfil(body) {
    return req("PUT", "/api/auth/me", body);
}

// ─── Usuários ──────────────────────────────────────────────────────────────

async function criarUsuario() {
    const nome = v("criar-u-nome").trim();
    const username = v("criar-u-username").trim();
    const senha = v("criar-u-senha");
    if (!nome || !username || !senha) return showMessagePopup("nome, username e senha são obrigatórios", true);
    return await req("POST", "/api/usuarios", { nome, username, senha, role: v("criar-u-role") });
}

function atualizarUsuario() {
    const id = v("upd-uid");
    if (!id) return showMessagePopup("Informe o ID", true);
    const body = {};
    if (v("upd-u-nome").trim()) body.nome = v("upd-u-nome").trim();
    if (v("upd-u-username").trim()) body.username = v("upd-u-username").trim();
    if (v("upd-u-senha")) body.senha = v("upd-u-senha");
    if (v("upd-u-role")) body.role = v("upd-u-role");
    req("PUT", `/api/usuarios/${id}`, body);
}

function deletarUsuario() {
    const id = v("del-uid");
    if (!id) return showMessagePopup("Informe o ID", true);
    if (!confirm(`Deletar usuário ${id}?`)) return;
    req("DELETE", `/api/usuarios/${id}`);
}

async function deletarUsuarioPorId(id) {
    return req("DELETE", `/api/usuarios/${id}`);
}

async function atualizarUsuarioPorId(id, body) {
    return req("PUT", `/api/usuarios/${id}`, body);
}

// ─── Peças ─────────────────────────────────────────────────────────────────

function listarPecas(query = "") {
    if (query) {
        return req("GET", `/api/pecas?busca=${query}`);
    }
    return req("GET", "/api/pecas");
}

function checarDisponibilidade() {
    const id = v("disp-peca-id");
    const data = v("disp-data");
    if (!id || !data) return showMessagePopup("ID e data são obrigatórios", true);
    req("GET", `/api/pecas/${id}/disponibilidade?data=${data}`);
}

async function criarPeca() {
    const nome = v("criar-peca-nome").trim();
    const tipo = document.getElementById("criar-peca-tipo").value;
    if (!nome) return showMessagePopup("Nome é obrigatório", true);
    if (!tipo) return showMessagePopup("Tipo é obrigatório", true);
    const foto = document.getElementById("criar-peca-foto").files[0];
    const form = new FormData();
    form.append("nome", nome);
    form.append("descricao", v("criar-peca-descricao"));
    form.append("quantidade", v("criar-peca-quantidade") || 0);
    form.append("tipo", tipo);
    if (foto) form.append("foto", foto);
    const { status, data } = await req("POST", "/api/pecas", form, true);
    if (status === 409) return showMessagePopup(data.erro || "Nome já existe", true);
}

function atualizarPeca() {
    const id = v("upd-peca-id");
    if (!id) return showMessagePopup("Informe o ID", true);
    const body = {};
    if (v("upd-peca-nome").trim()) body.nome = v("upd-peca-nome").trim();
    if (v("upd-peca-descricao").trim()) body.descricao = v("upd-peca-descricao").trim();
    if (v("upd-peca-quantidade") !== "") body.quantidade = parseInt(v("upd-peca-quantidade"));
    req("PUT", `/api/pecas/${id}`, body);
}

function ajustarQuantidade() {
    const id = v("delta-peca-id");
    const delta = v("delta-valor");
    if (!id || delta === "") return showMessagePopup("ID e delta são obrigatórios", true);
    req("PATCH", `/api/pecas/${id}/quantidade`, { delta: parseInt(delta) });
}

function deletarPeca() {
    const id = v("del-peca-id");
    if (!id) return showMessagePopup("Informe o ID", true);
    if (!confirm(`Deletar peça ${id}?`)) return;
    req("DELETE", `/api/pecas/${id}`);
}

async function deletarPecaPorId(id) {
    return req("DELETE", `/api/pecas/${id}`);
}

async function atualizarPecaPorId(id, body) {
    return req("PUT", `/api/pecas/${id}`, body);
}

// ─── Reservas ──────────────────────────────────────────────────────────────

function listarReservas(peca_id = null, apenas_ativas = false) {
    const params = new URLSearchParams();

    if (peca_id) params.append("peca_id", peca_id);
    if (apenas_ativas) params.append("ativas", "true");

    return req("GET", `/api/reservas?${params}`);
}

function listarUsuarios() {
    return req("GET", "/api/usuarios");
}

function criarReserva() {
    const peca_id = v("criar-res-peca-id");
    const data_retirada = v("criar-res-retirada");
    const data_prevista_devolucao = v("criar-res-devolucao");

    if (!peca_id || !data_retirada || !data_prevista_devolucao) {
        return showMessagePopup("peca_id, data_retirada e data_prevista_devolucao são obrigatórios", true );
    }

    const body = {
        itens: [{
            peca_id: parseInt(peca_id),
            quantidade: parseInt(v("criar-res-qtd") || 1)
        }],
        data_retirada,
        data_prevista_devolucao
    };

    if (v("criar-res-obs").trim()) {body.observacoes = v("criar-res-obs").trim();}

    req("POST", "/api/reservas", body);
}

async function criarReservaComBody(body) {
    return req("POST", "/api/reservas", body);
}

function atualizarReserva() {
    const id = v("upd-res-id");
    if (!id) {return showMessagePopup("Informe o ID", true);}

    const body = {};

    if (v("upd-res-retirada")) {body.data_retirada = v("upd-res-retirada");}
    if (v("upd-res-devolucao")) {body.data_prevista_devolucao = v("upd-res-devolucao");}
    if (v("upd-res-obs").trim()) {body.observacoes = v("upd-res-obs").trim();}

    req("PUT", `/api/reservas/${id}`, body);
}

function deletarReserva() {
    const id = v("del-res-id");
    if (!id) {
        return showMessagePopup("Informe o ID", true);
    }
    if (!confirm(`Cancelar reserva ${id}?`)) {
        return;
    }
    req("DELETE", `/api/reservas/${id}`)
        .then(({ status }) => {
            if (status === 200) {showMessagePopup("Reserva cancelada com sucesso!");}
        })
        .catch((err) => {
            if (err.status === 403) {
                showMessagePopup(err.message, true);
            } else {showMessagePopup("Erro ao cancelar reserva", true);}
        });
}