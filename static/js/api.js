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

    if (!res.ok && res.status !== 401) {
        // deixa o chamador tratar 401, lança o resto
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

    if (!username || !senha) return alert("Preencha username e senha");

    try {
        const { status, data } = await req("POST", "/api/auth/login", { username, senha });

        if (status === 200) {
            window.location.href = "/";
        } else {
            alert(data.mensagem || "Credenciais inválidas");
        }
    } catch (err) {
        alert(err.message);
    }
}

async function fazerLogout() {
    await req("POST", "/api/auth/logout");
    // o servidor apaga o cookie; redireciona para login
    window.location.href = "/login";
}

// ─── Usuários ──────────────────────────────────────────────────────────────

async function criarUsuario() {
    const nome = v("criar-u-nome").trim();
    const username = v("criar-u-username").trim();
    const senha = v("criar-u-senha");
    if (!nome || !username || !senha) return alert("nome, username e senha são obrigatórios");
    return await req("POST", "/api/usuarios", { nome, username, senha, role: v("criar-u-role") });
}

function atualizarUsuario() {
    const id = v("upd-uid");
    if (!id) return alert("Informe o ID");
    const body = {};
    if (v("upd-u-nome").trim()) body.nome = v("upd-u-nome").trim();
    if (v("upd-u-username").trim()) body.username = v("upd-u-username").trim();
    if (v("upd-u-senha")) body.senha = v("upd-u-senha");
    if (v("upd-u-role")) body.role = v("upd-u-role");
    req("PUT", `/api/usuarios/${id}`, body);
}

function deletarUsuario() {
    const id = v("del-uid");
    if (!id) return alert("Informe o ID");
    if (!confirm(`Deletar usuário ${id}?`)) return;
    req("DELETE", `/api/usuarios/${id}`);
}

// ─── Peças ─────────────────────────────────────────────────────────────────

function listarPecas() {
    return req("GET", "/api/pecas");
}

function checarDisponibilidade() {
    const id = v("disp-peca-id");
    const data = v("disp-data");
    if (!id || !data) return alert("ID e data são obrigatórios");
    req("GET", `/api/pecas/${id}/disponibilidade?data=${data}`);
}

async function criarPeca() {
    const nome = v("criar-peca-nome").trim();
    if (!nome) return alert("Nome é obrigatório");
    const foto = document.getElementById("criar-peca-foto").files[0];
    const form = new FormData();
    form.append("nome", nome);
    form.append("descricao", v("criar-peca-descricao"));
    form.append("quantidade", v("criar-peca-quantidade") || 0);
    if (foto) form.append("foto", foto);
    const { status, data } = await req("POST", "/api/pecas", form, true);
    if (status === 409) return alert(data.erro || "Nome já existe");
}

function atualizarPeca() {
    const id = v("upd-peca-id");
    if (!id) return alert("Informe o ID");
    const body = {};
    if (v("upd-peca-nome").trim()) body.nome = v("upd-peca-nome").trim();
    if (v("upd-peca-descricao").trim()) body.descricao = v("upd-peca-descricao").trim();
    if (v("upd-peca-quantidade") !== "") body.quantidade = parseInt(v("upd-peca-quantidade"));
    req("PUT", `/api/pecas/${id}`, body);
}

function ajustarQuantidade() {
    const id = v("delta-peca-id");
    const delta = v("delta-valor");
    if (!id || delta === "") return alert("ID e delta são obrigatórios");
    req("PATCH", `/api/pecas/${id}/quantidade`, { delta: parseInt(delta) });
}

function deletarPeca() {
    const id = v("del-peca-id");
    if (!id) return alert("Informe o ID");
    if (!confirm(`Deletar peça ${id}?`)) return;
    req("DELETE", `/api/pecas/${id}`);
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
    const data_devolucao = v("criar-res-devolucao");
    if (!peca_id || !data_retirada || !data_devolucao) return alert("peca_id, data_retirada e data_devolucao são obrigatórios");
    const body = { peca_id: parseInt(peca_id), data_retirada, data_devolucao, quantidade: parseInt(v("criar-res-qtd") || 1) };
    if (v("criar-res-obs").trim()) body.observacoes = v("criar-res-obs").trim();
    req("POST", "/api/reservas", body);
}

function atualizarReserva() {
    const id = v("upd-res-id");
    if (!id) return alert("Informe o ID");
    const body = {};
    if (v("upd-res-retirada")) body.data_retirada = v("upd-res-retirada");
    if (v("upd-res-devolucao")) body.data_devolucao = v("upd-res-devolucao");
    if (v("upd-res-qtd")) body.quantidade = parseInt(v("upd-res-qtd"));
    if (v("upd-res-obs").trim()) body.observacoes = v("upd-res-obs").trim();
    req("PUT", `/api/reservas/${id}`, body);
}

function deletarReserva() {
    const id = v("del-res-id");
    if (!id) return alert("Informe o ID");
    if (!confirm(`Deletar reserva ${id}?`)) return;
    req("DELETE", `/api/reservas/${id}`);
}