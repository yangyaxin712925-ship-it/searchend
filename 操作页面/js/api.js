const baseUrl = "http://118.126.65.238:8000"

// ============ 登录态（token） ============

const TOKEN_KEY = 'token'

// 优先取地址栏 token（兼容 file:// 直开 / 跨页面跳转），其次取 localStorage
function getToken() {
    const urlToken = new URLSearchParams(location.search).get('token')
    if (urlToken) {
        localStorage.setItem(TOKEN_KEY, urlToken)
        return urlToken
    }
    return localStorage.getItem(TOKEN_KEY) || ''
}

// ============ 通用请求 ============

async function request(url, options = {}) {
    // 自动携带 Authorization: Bearer <token>
    const token = getToken()
    if (token) {
        options = {
            ...options,
            headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
        }
    }
    let res
    try {
        res = await fetch(url, options)
    } catch (err) {
        // 网络层错误（后端未启动 / CORS / 断网）
        showToast('网络连接失败，请检查后端服务是否启动', 'error')
        throw err
    }
    const data = await res.json().catch(() => ({}))
    // 401：未登录 / 登录过期 / 凭证无效 → 清除登录态并跳转登录页
    if (res.status === 401) {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem('user_id')
        localStorage.removeItem('username')
        showToast(data.msg || '未登录，请先登录', 'error')
        setTimeout(() => { location.href = '../登陆页面/index.html' }, 600)
        throw new Error(data.msg || '未登录，请先登录')
    }
    // HTTP 错误或业务码非 200 都视为失败
    if (!res.ok || data.code !== 200) {
        const msg = data.msg || `请求失败（${res.status}）`
        showToast(msg, 'error')
        throw new Error(msg)
    }
    return data
}

function jsonBody(body) {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    }
}

// ============ Toast ============

let toastTimer = null
function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast')
    toast.textContent = msg
    toast.className = `toast ${type} show`
    toast.hidden = false
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => {
        toast.classList.remove('show')
        setTimeout(() => { toast.hidden = true }, 200)
    }, 2500)
}

// ============ 工具函数 ============

function escapeHtml(str) {
    if (str == null) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

function formatTime(str) {
    if (!str) return '-'
    // 2026-09-30T03:12:38 → 2026-09-30 03:12:38
    return String(str).replace('T', ' ')
}

function renderSkills(skills) {
    if (!skills) return '<span class="empty-text">-</span>'
    return `<div class="skill-tags">${skills.split(',').map(s => `<span class="skill-tag">${escapeHtml(s.trim())}</span>`).join('')}</div>`
}

function emptyRow(colspan, text = '暂无数据') {
    return `<tr class="empty-row"><td colspan="${colspan}">${text}</td></tr>`
}

// ============ Tab 切换 ============

function switchTab(tabName) {
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName)
    })
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === `panel-${tabName}`)
    })
    // 切换 tab 时刷新对应数据
    if (tabName === 'candidate') getAllCandidate()
    if (tabName === 'audit') getAuditLog()
}

// ============ 弹窗控制 ============

function openModal(id) {
    document.getElementById(id).hidden = false
}
function closeModal(id) {
    document.getElementById(id).hidden = true
}

// ============ 候选人模块 ============

async function getAllCandidate(filters = {}) {
    const table = document.getElementById('candidateTable')
    const count = document.getElementById('candidateCount')
    table.innerHTML = emptyRow(9, '加载中...')
    count.textContent = ''
    try {
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([k, v]) => {
            if (v) params.append(k, v)
        })
        const url = `${baseUrl}/candidate/list${params.toString() ? '?' + params : ''}`
        const data = await request(url)
        renderCandidateTable(data.data)
    } catch (err) {
        table.innerHTML = emptyRow(9, '加载失败')
    }
}

function renderCandidateTable(list) {
    const table = document.getElementById('candidateTable')
    const count = document.getElementById('candidateCount')
    if (!list || list.length === 0) {
        table.innerHTML = emptyRow(9, '暂无候选人数据')
        count.textContent = ''
        return
    }
    count.textContent = `（共 ${list.length} 条）`
    table.innerHTML = list.map(item => `
        <tr>
            <td>${escapeHtml(item.name)}</td>
            <td>${escapeHtml(item.gender)}</td>
            <td>${escapeHtml(item.phone)}</td>
            <td>${escapeHtml(item.education)}</td>
            <td>${escapeHtml(item.major)}</td>
            <td>${item.work_years != null ? escapeHtml(item.work_years) : '-'}</td>
            <td>${renderSkills(item.skills)}</td>
            <td>${formatTime(item.create_time)}</td>
            <td>
                <div class="action-group">
                    <button class="btn-link" data-action="detail" data-id="${item.id}">详情</button>
                    <button class="btn-link" data-action="edit" data-id="${item.id}">编辑</button>
                    <button class="btn-link" style="color:#dc2626" data-action="delete" data-id="${item.id}">删除</button>
                </div>
            </td>
        </tr>
    `).join('')
}

async function showCandidateModal(id = null) {
    const form = document.getElementById('candidateForm')
    form.reset()
    form.id.value = ''
    document.getElementById('candidateModalTitle').textContent = '新增候选人'
    if (id) {
        try {
            const data = await request(`${baseUrl}/candidate/detail/${id}`)
            const c = data.data
            document.getElementById('candidateModalTitle').textContent = '编辑候选人'
            Object.keys(c).forEach(key => {
                if (form[key]) form[key].value = c[key] ?? ''
            })
        } catch (err) {
            return
        }
    }
    openModal('candidateModal')
}

async function submitCandidateForm(e) {
    e.preventDefault()
    const formData = new FormData(e.target)
    const id = formData.get('id')
    const payload = {}
    for (const [k, v] of formData.entries()) {
        if (k === 'id') continue
        if (v !== '') {
            payload[k] = k === 'work_years' ? Number(v) : v
        }
    }
    try {
        if (id) {
            await request(`${baseUrl}/candidate/${id}`, { ...jsonBody(payload), method: 'PUT' })
            showToast('修改成功')
        } else {
            await request(`${baseUrl}/candidate/add`, jsonBody(payload))
            showToast('新增成功')
        }
        closeModal('candidateModal')
        await getAllCandidate()
        await getAuditLog()
    } catch (err) {
        // 错误已在 request 中提示
    }
}

async function showCandidateDetail(id) {
    try {
        const data = await request(`${baseUrl}/candidate/detail/${id}`)
        const c = data.data
        const body = document.getElementById('detailBody')
        body.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item"><span class="detail-label">ID</span><span class="detail-value">${escapeHtml(c.id)}</span></div>
                <div class="detail-item"><span class="detail-label">创建时间</span><span class="detail-value">${formatTime(c.create_time)}</span></div>
                <div class="detail-item"><span class="detail-label">姓名</span><span class="detail-value">${escapeHtml(c.name)}</span></div>
                <div class="detail-item"><span class="detail-label">性别</span><span class="detail-value">${escapeHtml(c.gender)}</span></div>
                <div class="detail-item"><span class="detail-label">联系方式</span><span class="detail-value">${escapeHtml(c.phone) || '-'}</span></div>
                <div class="detail-item"><span class="detail-label">学历</span><span class="detail-value">${escapeHtml(c.education) || '-'}</span></div>
                <div class="detail-item"><span class="detail-label">学校</span><span class="detail-value">${escapeHtml(c.school) || '-'}</span></div>
                <div class="detail-item"><span class="detail-label">专业</span><span class="detail-value">${escapeHtml(c.major) || '-'}</span></div>
                <div class="detail-item"><span class="detail-label">工作年限</span><span class="detail-value">${c.work_years ?? '-'}</span></div>
                <div class="detail-item"><span class="detail-label">期望薪资</span><span class="detail-value">${escapeHtml(c.expected_salary) || '-'}</span></div>
                <div class="detail-item full"><span class="detail-label">技能</span><span class="detail-value">${renderSkills(c.skills)}</span></div>
                <div class="detail-item full"><span class="detail-label">项目经验</span><span class="detail-value" style="white-space:pre-wrap">${escapeHtml(c.project_exp) || '-'}</span></div>
                <div class="detail-item full"><span class="detail-label">简历文件路径</span><span class="detail-value">${escapeHtml(c.resume_file_path) || '-'}</span></div>
            </div>
        `
        openModal('detailModal')
    } catch (err) {
        // 错误已提示
    }
}

async function deleteCandidate(id) {
    if (!confirm('确认删除这条候选人记录？删除后不可恢复')) return
    try {
        await request(`${baseUrl}/candidate/${id}`, { method: 'DELETE' })
        showToast('删除成功')
        await getAllCandidate()
        await getAuditLog()
    } catch (err) {
        // 错误已提示
    }
}

// ============ 审计日志模块 ============

async function getAuditLog(filters = {}) {
    const box = document.getElementById('auditLog')
    const count = document.getElementById('auditCount')
    box.innerHTML = '<div class="empty-row" style="padding:24px;text-align:center;color:#9ca3af">加载中...</div>'
    count.textContent = ''
    try {
        const params = new URLSearchParams()
        Object.entries(filters).forEach(([k, v]) => {
            if (v) params.append(k, v)
        })
        const url = `${baseUrl}/audit/logs${params.toString() ? '?' + params : ''}`
        const data = await request(url)
        renderAuditLog(data.data)
    } catch (err) {
        box.innerHTML = ''
    }
}

function renderAuditLog(list) {
    const box = document.getElementById('auditLog')
    const count = document.getElementById('auditCount')
    if (!list || list.length === 0) {
        box.innerHTML = '<div class="empty-row" style="padding:24px;text-align:center;color:#9ca3af">暂无日志</div>'
        count.textContent = ''
        return
    }
    count.textContent = `（共 ${list.length} 条）`
    box.innerHTML = list.map(item => {
        const type = escapeHtml(item.operate_type)
        let typeClass = 'log-type-other'
        if (/新增/.test(item.operate_type)) typeClass = 'log-type-add'
        else if (/修改|编辑|更新/.test(item.operate_type)) typeClass = 'log-type-update'
        else if (/删除/.test(item.operate_type)) typeClass = 'log-type-delete'
        const resultClass = item.result === '成功' ? 'log-result-success' : 'log-result-fail'
        return `
            <div class="log-block">
                <div class="log-head">
                    <span class="log-type ${typeClass}">${type}</span>
                    <span class="log-content">${escapeHtml(item.operate_content)}</span>
                    <span class="log-result ${resultClass}">${escapeHtml(item.result)}</span>
                </div>
                <div class="log-meta">
                    日志ID：${escapeHtml(item.id)} ｜ 操作人ID：${escapeHtml(item.user_id)} ｜ IP：${escapeHtml(item.ip_address) || '-'} ｜ 时间：${formatTime(item.operate_time)}
                </div>
            </div>
        `
    }).join('')
}

// ============ 表单收集工具 ============

function collectForm(form) {
    const data = {}
    new FormData(form).forEach((v, k) => {
        if (v) data[k] = v
    })
    return data
}

// ============ 事件绑定 ============

document.addEventListener('DOMContentLoaded', () => {
    // 未登录 → 跳转登录页
    if (!getToken()) {
        location.href = '../登陆页面/index.html'
        return
    }
    // 若地址栏携带 token，已存入 localStorage，清理地址栏参数
    if (new URLSearchParams(location.search).get('token')) {
        history.replaceState({}, '', location.pathname)
    }
    // Tab 切换
    document.querySelectorAll('.tab-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab))
    })

    // 弹窗关闭
    document.querySelectorAll('[data-close]').forEach(el => {
        el.addEventListener('click', () => closeModal(el.dataset.close))
    })
    // 点击遮罩关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal(overlay.id)
        })
    })

    // 候选人筛选
    document.getElementById('candidateFilterForm').addEventListener('submit', (e) => {
        e.preventDefault()
        getAllCandidate(collectForm(e.target))
    })
    document.getElementById('btnResetCandidate').addEventListener('click', () => {
        document.getElementById('candidateFilterForm').reset()
        getAllCandidate()
    })

    // 候选人新增按钮
    document.getElementById('btnAddCandidate').addEventListener('click', () => showCandidateModal())
    // 候选人表单提交
    document.getElementById('candidateForm').addEventListener('submit', submitCandidateForm)

    // 候选人列表事件委托（详情/编辑/删除）
    document.getElementById('candidateTable').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]')
        if (!btn) return
        const { action, id } = btn.dataset
        if (action === 'detail') showCandidateDetail(id)
        else if (action === 'edit') showCandidateModal(id)
        else if (action === 'delete') deleteCandidate(id)
    })

    // 日志筛选
    document.getElementById('auditFilterForm').addEventListener('submit', (e) => {
        e.preventDefault()
        getAuditLog(collectForm(e.target))
    })
    document.getElementById('btnResetAudit').addEventListener('click', () => {
        document.getElementById('auditFilterForm').reset()
        getAuditLog()
    })
    document.getElementById('btnRefreshLog').addEventListener('click', () => getAuditLog())

    // 初始加载
    getAllCandidate()
})
