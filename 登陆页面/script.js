// ============ 登录 / 注册（对接 FastAPI 后端） ============
const baseUrl = 'https://api.searchend.top'
// 登录/注册成功后返回主页面
const LOGIN_REDIRECT = '../主页面/index.html'

const signInBtn = document.getElementById('signIn')
const signUpBtn = document.getElementById('signUp')
const firstForm = document.getElementById('form1')
const secondForm = document.getElementById('form2')
const container = document.querySelector('.container')

// 面板切换
signInBtn.addEventListener('click', () => {
    container.classList.remove('right-panel-active')
})
signUpBtn.addEventListener('click', () => {
    container.classList.add('right-panel-active')
})

// ============ 工具函数 ============

function setMsg(id, text, type = 'error') {
    const el = document.getElementById(id)
    el.textContent = text || ''
    el.className = 'form-msg' + (type === 'success' ? ' success' : '')
}

function setLoading(btn, loading, text) {
    btn.disabled = loading
    if (loading) {
        btn.dataset.originText = btn.textContent
        btn.textContent = '...'
    } else {
        btn.textContent = btn.dataset.originText || text
    }
}

async function api(url, body) {
    let res
    try {
        res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        })
    } catch (err) {
        return { code: -1, msg: '网络连接失败，请检查后端服务是否启动' }
    }
    return res.json().catch(() => ({ code: -1, msg: `请求失败（${res.status}）` }))
}

// 登录：保存 token 到 localStorage
async function login(username, password) {
    const data = await api(`${baseUrl}/auth/login`, { username, password })
    if (data.code !== 200) {
        throw new Error(data.msg || '登录失败')
    }
    localStorage.setItem('token', data.data.token)
    localStorage.setItem('user_id', data.data.user_id)
    localStorage.setItem('username', data.data.username)
}

// ============ 登录提交 ============
secondForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const username = secondForm.username.value.trim()
    const password = secondForm.password.value
    if (!username || !password) {
        setMsg('loginMsg', '请输入用户名和密码')
        return
    }
    const btn = secondForm.querySelector('button[type="submit"]')
    setLoading(btn, true)
    setMsg('loginMsg', '')
    try {
        await login(username, password)
        location.href = LOGIN_REDIRECT
    } catch (err) {
        setMsg('loginMsg', err.message)
        setLoading(btn, false, 'Sign In')
    }
})

// ============ 注册提交：注册成功后自动登录并跳转主页面 ============
firstForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const username = firstForm.username.value.trim()
    const nickname = firstForm.nickname.value.trim()
    const password = firstForm.password.value
    if (!username || !password) {
        setMsg('registerMsg', '请输入用户名和密码')
        return
    }
    if (password.length < 6) {
        setMsg('registerMsg', '密码至少 6 位')
        return
    }
    const btn = firstForm.querySelector('button[type="submit"]')
    setLoading(btn, true)
    setMsg('registerMsg', '')
    try {
        const data = await api(`${baseUrl}/auth/register`, { username, password, nickname })
        if (data.code !== 200) {
            throw new Error(data.msg || '注册失败')
        }
        // 注册成功后自动登录，直接返回主页面
        await login(username, password)
        location.href = LOGIN_REDIRECT
    } catch (err) {
        setMsg('registerMsg', err.message)
        setLoading(btn, false, 'Sign Up')
    }
})
