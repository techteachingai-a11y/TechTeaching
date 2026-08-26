// ==UserScript==
// @namespace Tampermonkey
// @name 网盘下载助手
// @version 1.0
// @license MIT
// @homepage http://www.baidu.com
// @donwloadURL http://www.google.com
// @match https://*.bilibili.com/*
// @match https://pan.baidu.com/*
// @match https://pan.quark.cn/*
// @connect localhost
// @connect baidu.com
// @connect bilibili.com
// @connect quark.cn
// @connect 220.205.16.51
// @connect *
// @noframes
// @grant GM_info
// @grant GM_cookie
// @grant GM_addStyle
// @grant GM_download
// @grant GM_xmlhttpRequest
// @grant GM_openInTab
// @grant GM_getValue
// @grant GM_setValue
// @grant GM_setClipboard
// @grant unsafeWindow
// @grant window.onurlchange
// @run-at document-body
// ==/UserScript==
const u = {
        algorithm: {
            sha1: {
                hash: "SHA-1",
                hmac: {
                    name: "HMAC",
                    hash: {
                        name: "SHA-1"
                    }
                }
            },
            sha256: {
                hash: "SHA-256",
                hmac: {
                    name: "HMAC",
                    hash: {
                        name: "SHA-256"
                    }
                }
            },
            sha512: {
                hash: "SHA-512",
                hmac: {
                    name: "HMAC",
                    hash: {
                        name: "SHA-512"
                    }
                }
            }
        },
        host: () => location.hostname.split(".").slice(-2).join("_"),
        now: () => Math.floor(Date.now() / 1e3),
        uid: () => Date.now().toString(36).toUpperCase(),
        inone: (str, list) => list.some(t => str.includes(t)),
        inall: (str, list) => list.every(t => str.includes(t)),
        fixurl: str => str.startsWith("http") ? str : str.startsWith("//") ? `${location.protocol}${str}` : str.startsWith("/") ? `${location.origin}${str}` : `${location.origin}${location.pathname}/${str}`,
        rand: num => Math.floor(Math.random() * (num || 9)),
        serialize: data => "[object Object]" === Object.prototype.toString.call(data) ? new URLSearchParams(data).toString() : data,
        usp: str => str ? Object.fromEntries(new URLSearchParams(str)) : null,
        sleep: num => new Promise(resolve => setTimeout(resolve, 100 * num)),
        gmcookie: obj => new Promise(resolve => GM_cookie.list(void 0 === obj ? {} : "string" == typeof obj ? {
            name: obj
        } : obj, r => resolve(r))),
        rmcookie: obj => new Promise(resolve => GM_cookie.delete(void 0 === obj ? {} : "string" == typeof obj ? {
            name: obj
        } : obj, r => resolve(r))),
        ajax: data => new Promise(resolve => {
            const obj = {
                onerror: () => {
                    resolve({
                        code: 1,
                        message: "ajax.error"
                    })
                },
                ontimeout: () => {
                    resolve({
                        code: 1,
                        message: "ajax.timeout"
                    })
                },
                onload: r => {
                    box.hat = r.responseHeaders, resolve(box.hat?.includes("application/json") ? JSON.parse(r.responseText) : r.responseText)
                }
            };
            "string" == typeof data ? obj.url = data : Object.assign(obj, data), obj.method ??= obj.data ? "POST" : "GET", GM_xmlhttpRequest(obj)
        }),
        aria2: data => {
            Array.isArray(data?.url) && GM_xmlhttpRequest({
                url: box.aria2.jsonrpc,
                method: "POST",
                data: JSON.stringify({
                    id: crypto.randomUUID(),
                    method: "aria2.addUri",
                    params: [`token:${box.aria2.token}`, data.url, data.info]
                })
            })
        },
        cipher: size => {
            const bytes = new Uint8Array(size ?? 16);
            return crypto.getRandomValues(bytes), Array.from(bytes).map(i => "abcdefghijklmnopqrstuvwxyz23456789ABCDEFGHKLMNPSTVWXY" [i % 53]).join("")
        },
        dialog: data => {
            if (void 0 !== data) {
                let dom = document.querySelector("#liveDialog");
                null === dom && ((dom = document.createElement("dialog")).id = "liveDialog", dom.addEventListener("click", e => {
                    e.target === e.currentTarget && (e.preventDefault(), e.stopPropagation(), e.target.close())
                }), document.body.appendChild(dom)), dom.open || dom.showModal(), data instanceof HTMLElement ? dom.replaceChildren(data) : dom.innerHTML = data.toString().replaceAll("\n", "<br>")
            }
        },
        rmevt: element => {
            if (false == element instanceof HTMLElement) return null;
            const dom = element.cloneNode(true);
            return dom.getAttributeNames().filter(t => t.startsWith("on")).forEach(t => dom.removeAttribute(t)), element.parentElement.replaceChild(dom, element), dom
        },
        fixcookie: list => {
            const map = new Map((list ??= []).map(t => [t.name, t.value]));
            return Array.from(map).map(t => t.join("=")).join("; ")
        },
        xdialog: event => {
            event instanceof Event && (event.preventDefault(), event.stopPropagation());
            const dom = document.querySelector("#liveDialog");
            dom?.hasAttribute("open") && dom.close()
        },
        chunk: (list, size) => {
            size ??= 10;
            const arr = [];
            for (let i = 0; list.length > i; i += size) arr.push(list.slice(i, i + size));
            return arr
        },
        load: (k, v) => {
            v ??= null;
            const raw = GM_getValue(`${k}_${u.host()}`, null);
            if (raw === null) return v;
            try { return JSON.parse(u.rc4("_fd_key_", atob(raw))) } catch (e) { return raw }
        },
        save: (k, v) => {
            v ??= null, GM_setValue(`${k}_${u.host()}`, v !== null ? btoa(u.rc4("_fd_key_", JSON.stringify(v))) : v)
        },
        rc4: (k, v) => {
            const result = [],
                cube = [...Array(256).keys()],
                count = k.length;
            for (let x = 0, y = 0; y < 256; y++) x = (x + cube[y] + k.charCodeAt(y % count)) % 256, [cube[y], cube[x]] = [cube[x], cube[y]];
            for (let x = 0, y = 0, i = 0; i < v.length; i++) {
                y = (y + 1) % 256, x = (x + cube[y]) % 256, [cube[y], cube[x]] = [cube[x], cube[y]];
                const cipher = v.charCodeAt(i) ^ cube[(cube[y] + cube[x]) % 256];
                result.push(String.fromCharCode(cipher))
            }
            return result.join("")
        },
        tpl: (str, data) => {
            const regx = /\[([a-z]{2,12})]/g,
                arr = Array.isArray(data) ? data : [data];
            return arr.map(row => str.replaceAll(regx, (_match, itx) => Object.hasOwn(row, itx) ? row[itx] : itx)).join("")
        },
        form: (str, data) => {
            if (!/^[#.[\]\w\s-]+$/.test(str)) return;
            document.querySelectorAll(str + " [name]").forEach(t => {
                const s = t.getAttribute("name");
                if (Object.hasOwn(data, s)) {
                    const v = data[s];
                    switch (t.getAttribute("type")) {
                        case "checkbox":
                            t.checked = 1 == v;
                            break;
                        case "radio":
                            t.checked = t.value === v.toString();
                            break;
                        default:
                            t.value = v.toString()
                    }
                }
            })
        },
        input: (str, element) => {
            element.value = str, element.dispatchEvent(new Event("input", {
                bubbles: true
            }))
        },
        date: (str, num) => {
            str ??= "m-d H:M";
            let ts, i = Number.isInteger(num) ? num : 0;
            switch (i.toString().length) {
                case 10:
                    ts = new Date(1e3 * num);
                    break;
                case 13:
                    ts = new Date(num);
                    break;
                default:
                    ts = new Date
            }
            const obj = {
                y: ts.getFullYear(),
                m: 1 + ts.getMonth(),
                d: ts.getDate(),
                H: ts.getHours(),
                M: ts.getMinutes(),
                S: ts.getSeconds()
            };
            for (const k in obj) obj[k] = obj[k].toString().padStart(2, "0");
            return str.replaceAll(/[HMSdmy]/g, char => Object.hasOwn(obj, char) ? obj[char] : char)
        },
        cut: (str, begin, end) => {
            end ??= "";
            let x, y, i;
            return x = ~(i = str.lastIndexOf(begin)) ? i + begin.length : 0, y = end.length && ~(i = str.indexOf(end, x)) ? i : str.length, str.slice(x, y)
        },
        download: (url, name, info) => {
            if (void 0 !== url) {
                const obj = {
                    url: url,
                    name: name,
                    conflictAction: "prompt",
                    headers: {
                        referer: location.origin,
                        "User-Agent": navigator.userAgent
                    }
                };
                GM_download(Object.assign(obj, info))
            }
        },
        hash: async (str, algorithm, key) => {
            if (algorithm = (algorithm ??= "sha1").toLowerCase(), !Object.hasOwn(u.algorithm, algorithm)) return "";
            algorithm = u.algorithm[algorithm];
            let encoder = new TextEncoder,
                data = encoder.encode(str),
                bytes;
            if (null == key) bytes = await crypto.subtle.digest(algorithm.hash, data);
            else {
                const keyData = encoder.encode(key),
                    cryptoKey = await crypto.subtle.importKey("raw", keyData, algorithm.hmac, false, ["sign"]);
                bytes = await crypto.subtle.sign(algorithm.hmac, cryptoKey, data)
            }
            return Array.from(new Uint8Array(bytes)).map(b => b.toString(16).padStart(2, "0")).join("")
        }
    },
    box = {
        home: "http://220.205.16.51:20291",
        version: GM_info.script.version,
        homepage: GM_info.script.homepage,
        aria2: {
            jsonrpc: "http://localhost:6800/jsonrpc"
        },
        style: GM_getValue("style", ""),
        now: u.now(),
        icon: null,
        init: 0,
        wait: 0
    };
if (box.style.startsWith("@") ? GM_addStyle(box.style) : u.ajax(`${box.homepage}/assets/tampermonkey.css`).then(r => {
        r.startsWith("@") && (GM_setValue("style", r.replaceAll(/\s+/g, " ")), GM_addStyle(r))
    }), globalThis?.document) {
    let wait = false;
    Object.defineProperty(box, "wait", {
        get: () => wait,
        set: v => {
            wait = !!v, box.icon instanceof HTMLElement && (box.icon.className = wait ? "bi-arrow-clockwise spinner" : "bi-rocket")
        }
    })
}
const cleaner = async () => {
    const arr = await u.gmcookie();
    return await Promise.all(arr.map(t => u.rmcookie(t.name))), localStorage.clear(), arr
}, motrix = async num => {
    const body = {
            id: u.uid(),
            method: "aria2.changeGlobalOption",
            params: [`token:${box.aria2.token}`]
        },
        d = (body.params.push({
            "max-concurrent-downloads": num?.toString() ?? "1"
        }), await u.ajax({
            timeout: 2e3,
            url: box.aria2.jsonrpc,
            data: JSON.stringify(body)
        }));
    return "OK" === d?.result
};
if ("pan.baidu.com" === location.hostname) {
    const zset = e => {
            e instanceof Event && (e.preventDefault(), e.stopPropagation());
            const dom = document.createElement("form");
            dom.method = "dialog", dom.innerHTML = '<label>Motrix jsonrpc</label><label><svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 19H20C15.5817 19 12 22.5817 12 27C12 31.4183 15.5817 35 20 35H36C40.4183 35 44 31.4183 44 27C44 24.9711 43.2447 23.1186 42 21.7084" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 24.2916C4.75527 22.8814 4 21.0289 4 19C4 14.5817 7.58172 11 12 11H28C32.4183 11 36 14.5817 36 19C36 23.4183 32.4183 27 28 27H18" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><input name="jsonrpc" type="text" autocomplete="off" placeholder="http://localhost:16800/jsonrpc" required></label><label>Motrix Secret Key</label><label><svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#icon-4d18d1a67770af78)"><circle cx="15" cy="33" r="8" fill="none" stroke="#333" stroke-width="4"/><path d="M29 16L35.5 22" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 26L37 7" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 11L42 17.5" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="icon-4d18d1a67770af78"><rect width="48" height="48" fill="#333"/></clipPath></defs></svg><input name="token" type="text" autocomplete="off" placeholder="没有访问秘钥则保持为空"></label><label><input type="checkbox" name="legend">自动返回旧版页面</label><div class="group"><button type="button"><i class="bi-x-square"></i> 取消</button><button type="submit"><i class="bi-check2-square"></i> 确定</button></div><div style="display:flex;gap:2em;font-size:1rem"><span name="switcher">换号</span><span name="visit" style="color:#7f22fe">签到</span><span>积分<span name="num" style="margin-left:.5em">0</span></span><span name="msg"></span></div><p style="text-align:center;margin-block-start:0">在bilibili给自己喜欢的视频投币也可获取积分</p>', dom.addEventListener("submit", e => {
                e instanceof Event && (e.preventDefault(), e.stopPropagation());
                const body = new FormData(e.target);
                body.set("tiny", body.has("tiny") ? 1 : 0), body.set("legend", body.has("legend") ? 1 : 0), box.aria2 = {
                    ...box.opt,
                    ...Object.fromEntries(body)
                }, u.save("aria2", box.aria2), u.xdialog()
            }), dom.querySelector("button[type=button]").addEventListener("click", u.xdialog), dom.querySelector("span[name=visit]").addEventListener("click", e => {
                box.wait || (box.wait = 1, u.ajax({
                    url: `${box.home}/api/baiduvisit`,
                    data: JSON.stringify({
                        ui: box.ui
                    })
                }).then(d => {
                    dom.querySelector("span[name=msg]").textContent = d?.message, 0 === d?.code && (dom.querySelector("span[name=num]").textContent = d.num)
                }).finally(() => {
                    setTimeout(() => {
                        box.wait = 0
                    }, 2e3)
                }))
            }), dom.querySelector("span[name=switcher]").addEventListener("click", swaccount), u.dialog(dom), u.form("#liveDialog", box.aria2), u.ajax({
                url: `${box.home}/api/baidupi`,
                data: JSON.stringify({
                    ui: box.ui
                })
            }).then(d => {
                switch (d?.code) {
                    case 0:
                        /* version check removed */
                        dom.querySelector("span[name=num]").textContent = d.num, null === d.inviter && (dom.insertAdjacentHTML("afterend", '<br><form id="inviter"><label><i class="bi-arrow-left-right"></i><input name="inviter" type="text" autocomplete="off" placeholder="填写邀请码加50积分" required><button type="submit">兑换</button></label><p>脚本创建的那个文件夹的名称就是你的专属邀请码，将其分享后每次有人用你的邀请码兑换积分你也会加积分。</p></form>'), document.querySelector("#inviter").addEventListener("submit", e => {
                            e.preventDefault(), e.stopPropagation();
                            const body = Object.fromEntries(new FormData(e.target)),
                                i = (body.ui = box.ui, Number.parseInt(body.inviter, 16));
                            Number.isNaN(i) ? e.target.querySelector("input[name=inviter]").value = "" : u.ajax({
                                url: `${box.home}/api/baiduInviter`,
                                data: JSON.stringify(body)
                            }).then(d => {
                                0 === d?.code ? (e.target.style.cssText = "display: none", dom.querySelector("span[name=num]").textContent = d.num) : e.target.querySelector("input[name=inviter]").value = ""
                            })
                        }));
                        break;
                    case 1:
                        u.dialog("连接解析服务器失败");
                        break;
                    default:
                        u.dialog(d.message)
                }
            })
        },
        dlist = async list => {
            for (const i of list) await u.sleep(2), await u.ajax({
                url: `${box.home}/api/dlink1`,
                data: JSON.stringify({
                    ui: box.ui,
                    si: box.si,
                    fi: i
                })
            }).then(d => {
                0 === d?.code && u.aria2(d.data)
            })
        }, dlink = async e => {
            if (e instanceof Event && (e.preventDefault(), e.stopPropagation()), box.wait) return u.dialog("请稍后再操作");
            if (!await motrix()) return u.dialog("连接Motrix失败\n1. 检查Motrix是否运行\n2. 右键点击下载按钮查看设置是否正确\n如端口号和访问密钥是否匹配");
            let arr = await (async list => {
                let file = [],
                    folder = [];
                for (const i of list) i.isdir ? folder.push(i.path) : file.push(i);
                for (const i of folder) await fetch(`/rest/2.0/xpan/multimedia?method=listall&recursion=1&path=${encodeURIComponent(i)}`, {
                    method: "GET",
                    mode: "cors",
                    credentials: "include"
                }).then(r => r.json()).catch(err => ({
                    code: 1,
                    message: err.message
                })).then(d => {
                    Array.isArray(d?.list) && (file = file.concat(d.list.filter(t => !t.isdir)))
                });
                return file
            })(box.dcontext.instanceForSystem.list.getSelected());
            if (!arr.length) return u.dialog("未勾选可下载的文件资源");
            box.wait = 1;
            let d, busp = {
                    sign: box.ui.sign,
                    timestamp: box.ui.timestamp,
                    fidlist: "",
                    type: "dlink",
                    vip: "0",
                    channel: "chunlei",
                    web: "1",
                    app_id: "250528",
                    bdstoken: box.ui.token,
                    logid: box.ui.logid,
                    jsToken: unsafeWindow.jsToken,
                    clienttype: "0",
                    "dp-logid": unsafeWindow.bpDataInit.getDpLogId()
                },
                rows = [],
                chunks = u.chunk(arr.map(t => t.fs_id.toString()), 50);
            for (const i of chunks) {
                if (busp.fidlist = JSON.stringify(i), 0 !== (d = await fetch(`/api/download?${u.serialize(busp)}`).then(r => r.json()).catch(err => ({
                        code: 1,
                        message: err.message
                    })))?.errno) return box.wait = 0, u.dialog("读取文件信息失败\n请稍后刷新页面重试");
                rows.push(...d.dlink)
            }
            const map = new Map(rows.map(i => [i.fs_id, i]));
            if (arr = arr.map(t => {
                    const itx = map.get(t.fs_id.toString());
                    return t.dlink = itx ? itx.dlink : "", {
                        fid: t.fs_id.toString(),
                        out: t.path,
                        size: t.size,
                        dlink: t.dlink
                    }
                }).filter(t => t.dlink), box.wait = 0, !arr.length) return u.dialog("未勾选可下载的资源文件");
            if (0 !== (d = await u.ajax({
                    url: `${box.home}/api/baidupi`,
                    data: JSON.stringify({
                        ui: box.ui
                    })
                }))?.code) return u.dialog("连接解析服务器失败");
            /* version check removed */
            let file = arr.filter(i => i.out.startsWith(box.si.sdir) && 300 << 20 < i.size);
            /* points check removed */
            box.wait = 1, file.length && (0 === (d = await u.ajax({
                url: `${box.home}/api/dlink2`,
                data: JSON.stringify({
                    ui: box.ui,
                    si: box.si,
                    list: file
                })
            }))?.code ? await dlist(d.data) : u.dialog(d?.message)), (file = arr.filter(i => !i.out.startsWith(box.si.sdir) || 300 << 20 >= i.size)).length && await dlist(file), box.wait = 0
        }, slink = async e => {
            if (e instanceof Event && (e.preventDefault(), e.stopPropagation()), box.wait) return u.dialog("请稍后再操作");
            let arr = box.dcontext.instanceForSystem.list.getSelected();
            if (!arr.length) return u.dialog("未勾选可下载的文件资源");
            box.icon = e.currentTarget.querySelector("i"), box.wait = 1;
            let d = await u.ajax({
                url: `${box.home}/api/slist`,
                data: JSON.stringify({
                    ui: box.ui,
                    si: box.si,
                    list: arr
                })
            });
            return 0 !== d?.code ? (box.wait = 0, u.dialog(d?.message)) : (arr = d.data.map(t => (t.out.includes("sharelink") && (t.out = t.out.slice(t.out.indexOf("/", 9))), t)), d = await u.ajax({
                url: `${box.home}/api/baidupi`,
                data: JSON.stringify({
                    ui: box.ui
                })
            }), /* version & points check removed */ (0 === (d = await u.ajax({
                url: `${box.home}/api/dlink2`,
                data: JSON.stringify({
                    ui: box.ui,
                    si: box.si,
                    list: arr
                })
            }))?.code ? await dlist(d.data) : u.dialog(d?.message), void(box.wait = 0)))
        }, transfer = async e => {
            if (e instanceof Event && (e.preventDefault(), e.stopPropagation()), box.wait) return u.dialog("请稍后再操作");
            let arr = box.dcontext.instanceForSystem.list.getSelected();
            if (!arr.length) return u.dialog("未勾选可转存的文件资源");
            arr = arr.map(t => ({
                fs_id: t.fs_id.toString(),
                isdir: t.isdir,
                path: t.path,
                server_filename: t.server_filename
            })), box.icon = e.currentTarget.querySelector("i"), box.wait = 1;
            const d = await u.ajax({
                url: `${box.home}/api/slist`,
                data: JSON.stringify({
                    ui: box.ui,
                    si: box.si,
                    list: arr,
                    tree: 1
                })
            });
            if (0 === d?.code) {
                let body, busp = {
                        shareid: box.si.share,
                        from: box.si.uid,
                        sekey: box.si.sekey,
                        ondup: "fail",
                        async: "1",
                        app_id: "250528",
                        bdstoken: box.ui.token,
                        clienttype: "0"
                    },
                    queue = [{
                        fid: "root",
                        node: Object.assign(d.data, {
                            path: "/",
                            count: 1e6
                        })
                    }];
                for (; queue.length;) {
                    const {
                        fid,
                        node
                    } = queue.shift();
                    if (node.path.includes("sharelink") && (node.path = node.path.slice(node.path.indexOf("/"))), node.path.startsWith("/") || (node.path = "/" + node.path), node.count < 500) {
                        let path = node.path.split("/").slice(0, -1).join("/");
                        0 === path.length && (path = "/"), await zfolder(path), body = {
                            path: path,
                            fsidlist: JSON.stringify([fid])
                        }, await fetch(`/share/transfer?${u.serialize(busp)}`, {
                            method: "POST",
                            mode: "cors",
                            credentials: "include",
                            body: u.serialize(body),
                            headers: {
                                "Content-Type": "application/x-www-form-urlencoded"
                            }
                        })
                    } else {
                        if (node.files.length) {
                            await zfolder(node.path);
                            for (const i of arr = u.chunk(node.files, 500)) body = {
                                path: `${node.path}`,
                                fsidlist: JSON.stringify(i)
                            }, await fetch(`/share/transfer?${u.serialize(busp)}`, {
                                method: "POST",
                                mode: "cors",
                                credentials: "include",
                                body: u.serialize(body),
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded"
                                }
                            })
                        }
                        for (const k in node)["path", "count", "files"].includes(k) || queue.push({
                            fid: k,
                            node: node[k]
                        })
                    }
                }
            } else u.dialog(d?.message);
            box.wait = 0
        }, swaccount = async e => {
            e instanceof Event && (e.preventDefault(), e.stopPropagation());
            const cookie = await u.gmcookie(),
                arr = u.load("account", []).filter(t => t.uid !== box.ui.uid),
                dom = (arr.push({
                    cookie: cookie,
                    uid: box.ui.uid,
                    name: box.ui.name,
                    face: box.ui.face
                }), u.save("account", arr), document.createElement("ul"));
            dom.classList.add("account"), dom.innerHTML = u.tpl('<li data-uid="[uid]"><img src="[face]"><div>[name]<br>[uid]</div></li>', arr) + '<li class="btn"><i class="bi-plus-square-dotted"></i> 登录新的账号</li>', dom.addEventListener("click", async e => {
                e instanceof Event && (e.preventDefault(), e.stopPropagation());
                const element = e.target.closest("li");
                if (null !== element && element.dataset.uid !== box.ui.uid) {
                    if (element.classList.contains("btn")) return await cleaner(), localStorage.clear(), location.replace("https://pan.baidu.com/login");
                    const itx = arr.find(t => t.uid === element.dataset.uid);
                    if (void 0 !== itx) {
                        await cleaner();
                        const task = itx.cookie.map(t => new Promise(resolve => GM_cookie.set(t, r => resolve(r))));
                        await Promise.all(task), setTimeout(() => {
                            location.reload()
                        }, 1e3)
                    }
                }
            }), u.dialog(dom)
        }, zfolder = async str => {
            if (2 <= (str = str.replaceAll("//", "/")).length) {
                const body = {
                        path: str,
                        isdir: "1",
                        rtype: "0",
                        block_list: "[]"
                    },
                    busp = {
                        a: "commit",
                        channel: "chunlei",
                        web: "1",
                        app_id: "250528",
                        bdstoken: box.ui.token,
                        logid: box.ui.logid,
                        clienttype: "0"
                    };
                await fetch(`/api/create?${u.serialize(busp)}`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/x-www-form-urlencoded"
                    },
                    body: u.serialize(body)
                })
            }
        };
    if (box.opt = {
            legend: 0,
            token: "",
            jsonrpc: "http://localhost:16800/jsonrpc"
        }, box.aria2 = u.load("aria2", box.opt), "/share/init" === location.pathname && GM_addStyle("#init-new{background: none !important}#ft,iframe{display: none !important}"), "/disk/main" === location.pathname && "1" === box.aria2.legend) {
        const s = location.hash;
        if ("" === s || s.startsWith("#/index")) {
            const map = new URLSearchParams(u.cut(s, "?"));
            map.has("path") || map.set("path", "/"), map.set("vmode", "list"), location.replace(`https://pan.baidu.com/disk/home?stayAtHome=true#/all?${map.toString()}`)
        }
    }
    if ("/disk/home" === location.pathname && (GM_addStyle('#layoutMain{font-size:14px}div.file-name{font-family:"Microsoft YaHei UI", monospace}.wp-side-options,span.newIcon,span[node-type=find-apps],[node-type=header-union],dd.desc-box>div,img.btn-img-tips,span.user-name,[node-type=header-apps],dd:has(> .dir-card-small, > .dir-share-small, > .dir-apps-small),a.g-button[data-button-id="b65"],.dialog-extra,.uickpry{display:none !important}'), unsafeWindow.XMLHttpRequest = new Proxy(XMLHttpRequest, {
            construct: target => {
                let url, payload;
                return new Proxy(new target, {
                    set: (target, prop, value) => Reflect.set(target, prop, value),
                    get: (target, prop) => {
                        let value = target[prop];
                        if ("function" == typeof value && (value = function() {
                                return "open" === prop && (url = arguments[1]), "send" === prop && (payload = arguments[0]), Reflect.apply(target[prop], target, arguments)
                            }), "responseText" === prop) {
                            if (url.includes("/adx")) {
                                const d = JSON.parse(value);
                                d.hasOwnProperty("list") && (d.list = null, d.error_code = 31402, value = JSON.stringify(d))
                            }
                            if (url.includes("/api/quota")) {
                                const map = new URLSearchParams(u.cut(url, "?"));
                                box.init || (async map => {
                                    if (!box.init) {
                                        let tip = "脚本初始化失败 请尝试以下操作\n1. 关闭其他可能冲突的脚本和插件\n2. 清理浏览器本地缓存并重新登录网盘账号\n3. 重新安装脚本\n\n",
                                            d, body, busp;
                                        if ((box.init = 1) !== (d = await fetch("/rest/2.0/membership/user/info?method=query&clienttype=0&app_id=250528&web=1").then(r => r.json()).catch(err => ({
                                                code: 1,
                                                message: err.message
                                            })))?.user_info?.loginstate) return u.dialog(tip);
                                        const cookie = u.fixcookie(await u.gmcookie());
                                        if (!cookie.includes("BDUSS")) return u.dialog("1. 脚本管理器需要使用红猴\n2. 尝试换Firefox浏览器使用");
                                        if (box.dcontext = unsafeWindow.require("system-core:context/context.js"), box.ui = {
                                                cookie: cookie,
                                                uid: d.user_info.uk.toString(),
                                                vip: d.user_info.is_svip ? 2 : 0,
                                                name: d.user_info.username,
                                                face: d.user_info.photo,
                                                logid: map.get("logid"),
                                                token: map.get("bdstoken")
                                            }, box.ui.uid !== GM_getValue("account.baidu") && GM_setValue("account.baidu", box.ui.uid), busp = {
                                                fields: '["sign1","sign3","timestamp"]',
                                                channel: "chunlei",
                                                web: "1",
                                                app_id: "250528",
                                                bdstoken: box.ui.token,
                                                logid: box.ui.logid,
                                                clienttype: "0",
                                                "dp-logid": unsafeWindow.bpDataInit.getDpLogId()
                                            }, 0 !== (d = await fetch(`/api/gettemplatevariable?${u.serialize(busp)}`).then(r => r.json()).catch(err => ({
                                                code: 1,
                                                message: err.message
                                            })))?.errno) return u.dialog(tip);
                                        box.ui.timestamp = d.result.timestamp, box.ui.sign = btoa(u.rc4(d.result.sign3, d.result.sign1)), "true" !== localStorage.getItem(`tipshut`) && (localStorage.setItem(`${box.ui.uid}_wp_guide`, "true"), localStorage.setItem(`guideShareDirTip_${box.ui.uid}`, "true"), localStorage.setItem(`closeDeviceDialog_${box.ui.uid}`, "true"), localStorage.setItem("isShowNewUtilsTip", "true"), localStorage.setItem("pref_upload_ins_guide", "1"), localStorage.setItem("img_menu_ocr_undefined", "1"), localStorage.setItem("ee-ai-ppt-pop", "1"), localStorage.setItem("tipshut", "true"));
                                        let dom = document.querySelector(".blue-upload").closest("div");
                                        if (!dom) return u.dialog("请尝试刷新页面");
                                        if (dom.insertAdjacentHTML("afterbegin", '<button name="dlink" style="border:none;background-color:#7f22fe;color:#fff;height:34px;line-height:34px;padding:0 18px;margin-right:5px;border-radius:4px;font-size:14px;"><i class="bi-rocket"></i> 下载</button>'), dom = dom.querySelector("button[name=dlink]"), box.icon = dom.querySelector("i"), dom.addEventListener("click", dlink), dom.addEventListener("contextmenu", zset), 1 === (d = await u.ajax({
                                                url: `${box.home}/api/baidusi`,
                                                data: JSON.stringify({
                                                    ui: box.ui
                                                })
                                            }))?.code) return u.dialog("连接解析服务器失败");
                                        if (0 !== d?.code || (box.si = d.data, 200 !== (d = await fetch(`https://pan.baidu.com/share/init?surl=${box.si.surl}`, {
                                                method: "HEAD"
                                            })).status)) {
                                            if (box.si = {}, box.si.sdir = `/${Number.parseInt(box.ui.uid).toString(16).toUpperCase()}`, busp = {
                                                    target: JSON.stringify([box.si.sdir]),
                                                    channel: "chunlei",
                                                    web: "1",
                                                    app_id: "250528",
                                                    bdstoken: box.ui.token,
                                                    logid: box.ui.logid,
                                                    clienttype: "0",
                                                    "dp-logid": unsafeWindow.bpDataInit.getDpLogId()
                                                }, 0 === (d = await fetch(`/api/filemetas?${u.serialize(busp)}`).then(r => r.json()).catch(err => ({
                                                    code: 1,
                                                    message: err.message
                                                })))?.errno) box.si.fid = d.info[0].fs_id.toString();
                                            else {
                                                if (body = {
                                                        path: box.si.sdir,
                                                        isdir: "1",
                                                        rtype: "0",
                                                        block_list: "[]"
                                                    }, busp = {
                                                        a: "commit",
                                                        channel: "chunlei",
                                                        web: "1",
                                                        app_id: "250528",
                                                        bdstoken: box.ui.token,
                                                        logid: box.ui.logid,
                                                        clienttype: "0",
                                                        "dp-logid": unsafeWindow.bpDataInit.getDpLogId()
                                                    }, !(d = await fetch(`/api/create?${u.serialize(busp)}`, {
                                                        method: "POST",
                                                        headers: {
                                                            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                                                        },
                                                        body: u.serialize(body)
                                                    }).then(r => r.json()))?.path) return u.dialog(tip + "error: 用户文件夹创建失败");
                                                box.si.fid = d.fs_id.toString(), box.si.sdir = d.path
                                            }
                                            return box.si.pwd = u.cipher(4), body = {
                                                channel_list: "[]",
                                                period: "0",
                                                pwd: box.si.pwd,
                                                schannel: "4",
                                                fid_list: JSON.stringify([box.si.fid])
                                            }, busp = {
                                                channel: "chunlei",
                                                web: 1,
                                                app_id: "250528",
                                                bdstoken: box.bdstoken,
                                                logid: box.ui.logid,
                                                clienttype: 0,
                                                "dp-logid": unsafeWindow.bpDataInit.getDpLogId()
                                            }, 0 !== (d = await fetch(`/share/set?${u.serialize(busp)}`, {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
                                                },
                                                body: u.serialize(body)
                                            }).then(r => r.json()).catch(err => ({
                                                code: 1,
                                                message: err.message
                                            })))?.errno ? u.dialog(tip + "error: 用户文件夹设置分享失败\n可能是创建的分享过多请尝试清理") : (box.si.share = d.shareid.toString(), box.si.surl = u.cut(d.link, "/s/", "?").slice(1), 200 !== (d = await fetch(`https://pan.baidu.com/share/init?surl=${box.si.surl}`, {
                                                method: "HEAD"
                                            })).status ? u.dialog(tip + "error: 读取用户分享信息失败\n请尝试刷新页面") : (box.si.skey = decodeURIComponent(u.cut(document.cookie, "BDCLND=", ";")), void await u.ajax({
                                                url: `${box.home}/api/baidusi`,
                                                data: JSON.stringify({
                                                    ui: box.ui,
                                                    si: box.si
                                                })
                                            })))
                                        }
                                        box.si.skey = decodeURIComponent(u.cut(document.cookie, "BDCLND=", ";"))
                                    }
                                })(map)
                            }
                        }
                        return value
                    }
                })
            }
        })), "/login" === location.pathname) {
        const dom = document.querySelector(".bd-login-button");
        dom && (dom.insertAdjacentHTML("beforeend", '<button name="login" style="margin-inline:2em;background-color:transparent;font-size:16px;cursor:default">快捷登录</button>'), document.querySelector("[name=login]").addEventListener("click", e => {
            e instanceof Event && (e.preventDefault(), e.stopPropagation());
            const arr = u.load("account", []);
            if (0 === arr.length) return u.dialog("暂无可快捷登录的账号");
            const dom = document.createElement("ul");
            dom.classList.add("account"), dom.innerHTML = u.tpl('<li data-uid="[uid]"><img src="[face]"><div>[name]<br>[uid]</div></li>', arr), dom.addEventListener("click", async e => {
                e instanceof Event && (e.preventDefault(), e.stopPropagation());
                const element = e.target.closest("li");
                if (null !== element) {
                    const itx = arr.find(t => t.uid === element.dataset.uid);
                    if (void 0 !== itx) {
                        await cleaner();
                        const task = itx.cookie.map(t => new Promise(resolve => GM_cookie.set(t, r => resolve(r))));
                        await Promise.all(task), await u.sleep(5), location.replace("https://pan.baidu.com/disk/home?stayAtHome=true#/all")
                    }
                }
            }), u.dialog(dom)
        }))
    }
    location.pathname.startsWith("/s/") && (GM_addStyle("#bd-main>div.bd-left{max-width: 960px; margin: 0 auto !important}#layoutApp{background-color: transparent !important}body{background-image: url('https://firefox-settings-attachments.cdn.mozilla.net/main-workspace/newtab-wallpapers-v2/d9289c5b-8c78-4b27-b5d8-afe7285ce7d1.avif') !important}"), GM_addStyle(".btn-img-tips,.call-pc-client-btn,.rights-section-banner-tag,.bd-aside-ad,.module-share-footer,#layoutHeader,div.report-bad,div.slide-show-center,div.slide-show-right{display: none !important}"), GM_addStyle("div.group{--radius:1em;display:inline-flex;gap:0;height:fit-content;border:none;border-radius:var(--radius);background-color:#09f;&>button{flex:1;border:none;border-radius:unset;background-color:unset;text-align:center;color:#fff;line-height:2.5;display:inline-block;outline:none;padding-inline:2em;white-space:nowrap;font-size:.875rem;cursor:default;transition-duration:500ms;transition-property:background-color;&:first-child{border-top-left-radius:var(--radius);border-bottom-left-radius:var(--radius)}&:last-child{border-top-right-radius:var(--radius);border-bottom-right-radius:var(--radius)}&:hover{background-color:#0003;color:#fff}}}"), (async () => {
        if (!box.init) {
            box.init = 1;
            const d = await fetch("/rest/2.0/membership/user/info?method=query&clienttype=0&app_id=250528&web=1").then(r => r.json()).catch(err => ({
                code: 1,
                message: err.message
            }));
            if (1 !== d?.user_info?.loginstate) return location.replace("https://pan.baidu.com/login");
            const cookie = u.fixcookie(await u.gmcookie());
            if (!cookie.includes("BDUSS")) return u.dialog("1. 脚本管理器需要使用红猴\n2. 尝试换Firefox浏览器使用");
            box.dcontext = unsafeWindow.require("system-core:context/context.js"), box.ui = {
                cookie: cookie,
                uid: d.user_info.uk.toString(),
                vip: d.user_info.is_svip ? 2 : 0,
                name: d.user_info.username,
                face: d.user_info.photo,
                token: unsafeWindow?.yunData?.bdstoken
            }, box.ui.uid !== GM_getValue("account.baidu") && GM_setValue("account.baidu", box.ui.uid), box.si = {
                uid: unsafeWindow?.yunData?.share_uk,
                surl: location.pathname.slice(4),
                share: unsafeWindow?.yunData?.shareid,
                sekey: unsafeWindow?.currentSekey
            };
            const dom = document.querySelector("div.bottom-save-path-wrap");
            null !== dom && (dom.nextElementSibling.style.cssText = "display: none", dom.insertAdjacentHTML("afterend", '<div class="group"><button name="transfer"><i class="bi-arrow-left-right"></i> 转存</button><button name="slink"><i class="bi-cloud-download"></i> 下载</button></div>'), document.querySelector("div.group > button[name='slink']")?.addEventListener("click", slink), document.querySelector("div.group > button[name='transfer']")?.addEventListener("click", transfer), document.body.removeAttribute("style"))
        }
    })())
}
if ("pan.quark.cn" === location.hostname) {
    GM_addStyle('.header-btn-group{margin-right:1em}.share-info-wrap,.illegal-file-icon,.share-info-wrap .report-btn,.share-info-wrap .open-share,.next-box.share-right-side-content,[class^="CommonFooter"],[class^="CommonHeader--right"],[class^="UserInfoV2--tit-right"],div[class^="UserInfoV2--tips"],tr.drag-bottom,.file-search-box~div,.file-search-box~span,.list-all-empty,#portal-message+div,body>div[style]{display:none !important}');
    const zset = e => {
            e instanceof Event && (e.preventDefault(), e.stopPropagation());
            const dom = document.createElement("form");
            dom.method = "dialog", dom.innerHTML = '<label>Motrix jsonrpc</label><label><svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M30 19H20C15.5817 19 12 22.5817 12 27C12 31.4183 15.5817 35 20 35H36C40.4183 35 44 31.4183 44 27C44 24.9711 43.2447 23.1186 42 21.7084" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 24.2916C4.75527 22.8814 4 21.0289 4 19C4 14.5817 7.58172 11 12 11H28C32.4183 11 36 14.5817 36 19C36 23.4183 32.4183 27 28 27H18" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><input name="jsonrpc" type="text" autocomplete="off" placeholder="http://localhost:16800/jsonrpc" required></label><label>Motrix Secret Key</label><label><svg width="24" height="24" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"><g clip-path="url(#icon-4d18d1a67770af78)"><circle cx="15" cy="33" r="8" fill="none" stroke="#333" stroke-width="4"/><path d="M29 16L35.5 22" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 26L37 7" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M35 11L42 17.5" stroke="#333" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></g><defs><clipPath id="icon-4d18d1a67770af78"><rect width="48" height="48" fill="#333"/></clipPath></defs></svg><input name="token" type="text" autocomplete="off" placeholder="没有访问秘钥则保持为空"></label><div class="group"><button type="button"><i class="bi-x-square"></i> 取消</button><button type="submit"><i class="bi-check2-square"></i> 确定</button></div>', dom.addEventListener("submit", e => {
                const body = new FormData(e.target);
                box.aria2 = {
                    ...box.opt,
                    ...Object.fromEntries(body)
                }, u.save("aria2", box.aria2), u.xdialog()
            }), dom.querySelector("button[type=button]").addEventListener("click", u.xdialog), u.dialog(dom), u.form("#liveDialog", box.aria2)
        },
        init = async () => {
            if (!box.init) {
                box.init = 1;
                const cookie = u.fixcookie(await u.gmcookie());
                if (!cookie.includes("__pus")) return u.dialog("1. 脚本管理器需要使用红猴\n2. 尝试换Firefox浏览器使用");
                if (!cookie.includes("__uid")) return u.dialog("请重新登录夸克网盘");
                box.ui = {
                    cookie: cookie,
                    uid: u.cut(cookie, "__uid=", ";")
                };
                const d = await u.ajax({
                    url: `${box.home}/api/quarkpi`,
                    method: "POST",
                    data: JSON.stringify({
                        ui: box.ui
                    })
                });
                if (1 === d?.code) return u.dialog("连接解析服务器失败");
                /* version check removed */
                if (location.pathname.startsWith("/list")) {
                    const dom = document.createElement("button");
                    dom.name = "dlink", dom.style.cssText = "border:none;background-color:#0d53ff;color:#fff;height:36px;line-height:36px;padding:0 18px;margin-right:1em;border-radius:.5em;font-size:14px;vertical-align: bottom", dom.innerHTML = '<i class="bi-rocket"></i> 下载', dom.addEventListener("click", dlink), dom.addEventListener("contextmenu", zset), box.icon = dom.querySelector("i"), box.dlink = dom
                }
                if (location.pathname.startsWith("/s/")) {
                    let count = 0,
                        timer = setInterval(() => {
                            let dom = document.querySelector("div.operate-wrap");
                            if (dom) {
                                clearInterval(timer);
                                let pos = "beforeend";
                                2 === dom.childElementCount && (dom = dom.children[1], pos = "afterbegin"), dom.insertAdjacentHTML(pos, '<button class="box"><i class="bi-rocket"></i> 下载</button>');
                                const element = dom.querySelector("button.box");
                                element.addEventListener("click", slink), element.addEventListener("contextmenu", zset), box.icon = element.querySelector("i")
                            } else count++ < 9 || clearInterval(timer)
                        }, 1e3)
                }
            }
        }, dlink = async e => {
            if (e instanceof Event && (e.preventDefault(), e.stopPropagation()), box.wait) return u.dialog("请稍后再操作");
            if (!await motrix(8)) return u.dialog("连接Motrix失败\n1. 检查Motrix是否运行\n2. 右键点击下载按钮查看设置是否正确");
            let arr = [],
                map = new Map(box.list.map(t => [t.fid, t]));
            if (document.querySelectorAll("tr.ant-table-row-selected").forEach(dom => arr.push(map.get(dom.dataset.rowKey))), 0 === arr.length) return u.dialog("未勾选可下载的文件资源");
            box.wait = 1;
            const s = decodeURIComponent(location.hash).split("/").slice(3).map(t => t.split("-", 2)[1]).join("/"),
                d = await u.ajax({
                    url: `${box.home}/api/dlinkQuark`,
                    data: JSON.stringify({
                        ui: box.ui,
                        path: `quark/${s}`,
                        list: arr
                    })
                });
            if (0 === d?.code) {
                map = new Map(d.data.map(t => [t.fid, t]));
                const hat = [`Cookie: ${box.ui.cookie}`, `User-Agent: ${navigator.userAgent}`];
                if ((arr = d.data.filter(t => 50 << 20 >= t.size)).length) {
                    const file = u.chunk(arr, 99);
                    for (const i of file) await u.ajax({
                        url: "https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpro&fr=pc",
                        data: JSON.stringify({
                            fids: i.map(t => t.fid)
                        })
                    }).then(d => {
                        0 === d?.code && d.data.forEach(t => {
                            const i = map.get(t.fid);
                            u.aria2({
                                url: [t.download_url],
                                info: {
                                    header: hat,
                                    split: "8",
                                    out: i.out
                                }
                            })
                        })
                    })
                }
                if ((arr = d.data.filter(t => 50 << 20 < t.size)).length) {
                    const file = u.chunk(arr, 99);
                    for (const i of file) await u.ajax({
                        url: "https://drive-pc.quark.cn/1/clouddrive/file/download?pr=ucpr&fr=pc",
                        data: JSON.stringify({
                            fids: i.map(t => t.fid)
                        }),
                        headers: {
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) quark-cloud-drive/3.23.2 Chrome/112.0.5615.165 Electron/24.1.3.8 Safari/537.36 Channel/pckk_other_ch"
                        }
                    }).then(d => {
                        0 === d?.code && d.data.forEach(t => {
                            const i = map.get(t.fid);
                            u.aria2({
                                url: [t.download_url],
                                info: {
                                    header: hat,
                                    split: "64",
                                    out: i.out
                                }
                            })
                        })
                    })
                }
            } else u.dialog(d.message);
            box.wait = 0
        }, slink = async e => {
            if (e instanceof Event && (e.preventDefault(), e.stopPropagation()), box.wait) return u.dialog("请稍后再操作");
            if (!await motrix(8)) return u.dialog("连接Motrix失败\n1. 检查Motrix是否运行\n2. 右键点击下载按钮查看设置是否正确\n如端口号和访问密钥是否匹配");
            const arr = document.querySelectorAll("tr.ant-table-row-selected");
            if (0 === arr.length) return u.dialog("未勾选可下载的文件资源");
            arr.forEach(t => box.share.list.push(t.dataset.rowKey)), box.wait = 1, box.share.curdir = u.cut(location.hash, "/");
            const d = await u.ajax({
                url: `${box.home}/api/slinkQuark`,
                data: JSON.stringify({
                    ui: box.ui,
                    share: box.share
                })
            });
            if (0 === d?.code) {
                const hat = [`Cookie: ${d.data.cookie}`, `User-Agent: ${navigator.userAgent}`];
                for (const i of d.data.list) u.aria2({
                    url: [i.link],
                    info: {
                        header: hat,
                        split: "64",
                        out: i.out
                    }
                })
            }
            box.wait = 0
        };
    box.opt = {
        jsonrpc: "http://localhost:16800/jsonrpc",
        token: ""
    }, box.aria2 = u.load("aria2", box.opt), location.pathname.startsWith("/list") && (GM_addStyle('#ice-container{max-width:1280px}div[class^="SectionHeaderController--section-header-right"]{margin-right:0 !important}'), unsafeWindow.XMLHttpRequest = new Proxy(XMLHttpRequest, {
        construct: target => {
            let url, payload;
            return new Proxy(new target, {
                set: (target, prop, value) => Reflect.set(target, prop, value),
                get: (target, prop) => {
                    let value = target[prop];
                    if ("function" == typeof value && (value = function() {
                            return "open" === prop && (url = arguments[1]), "send" === prop && (payload = arguments[0]), Reflect.apply(target[prop], target, arguments)
                        }), "responseText" === prop) {
                        if (url.includes("/sort")) {
                            const d = JSON.parse(value);
                            0 === d?.code && (box.list = d.data.list.map(t => ({
                                fid: t.fid,
                                pdir_fid: t.pdir_fid,
                                size: t.size,
                                file_name: t.file_name,
                                file: t.file
                            }))), init().finally(() => {
                                if (void 0 !== box.dlink) {
                                    let dom = document.querySelector("button[name='dlink']");
                                    null === dom && (dom = document.querySelector(".btn-operate>.btn-main")) && box.dlink && dom.insertAdjacentElement("afterbegin", box.dlink)
                                }
                            })
                        }
                        if (url.includes("/clouddrive/member")) {
                            const d = JSON.parse(value);
                            0 === d?.code && (d.data = {...d.data, member_type: "SUPER_VIP", subscribe_status: 1}, value = JSON.stringify(d))
                        }
                    }
                    return value
                }
            })
        }
    })), location.pathname.startsWith("/s/") && (GM_addStyle('div[class*="DetailLayout--header"],div.share-download{display: none !important}'), GM_addStyle("button.box{display:flex;gap:.25em;align-items:center;background-color:transparent;border:1px solid #ccc;border-radius:6px;margin-inline-end:1.25em;padding-inline:1em;cursor:default;line-height:2.25em;&:hover{background-color:#0009;border-color:#0006;color:#fff}&>i{margin-inline-end:0!important}}"), unsafeWindow.XMLHttpRequest = new Proxy(XMLHttpRequest, {
        construct: target => {
            let url, payload;
            return new Proxy(new target, {
                set: (target, prop, value) => Reflect.set(target, prop, value),
                get: (target, prop) => {
                    let value = target[prop];
                    if ("function" == typeof value && (value = function() {
                            return "open" === prop && (url = arguments[1]), "send" === prop && (payload = arguments[0]), Reflect.apply(target[prop], target, arguments)
                        }), "responseText" === prop && url.includes("/share/sharepage/detail")) {
                        const d = JSON.parse(value);
                        if (0 !== d?.code) return value;
                        Object.hasOwn(d.data, "share") && (init(), box.share = {
                            id: d.data.share.share_id,
                            code: d.data.share.passcode ?? "",
                            name: d.data.share.pwd_id,
                            list: []
                        })
                    }
                    return value
                }
            })
        }
    }))
}
if (location.hostname.includes("bilibili.com")) {
    GM_addStyle(".video-card-ad-small,.space-notice,.video-ai-assistant-bg::after,.video-ai-assistant-bg::before,#notice,#slide_ad,#tool-bar-more,.btn-ad,.img-ad,.b-footer-wrap>.split-line,.other-link,.footer-icons,.recommended-swipe,.act-end,.act-now,.ad-report,.adblock-tips,.adcard,.bpx-player-error-sign,.bpx-player-toast-wrap,.container>.bili-video-card:not(.enable-no-interest),.container>.feed-card,.container>.floor-single-card,.container>.grid-anchor,.download-entry,.download-entry,.eva-banner,.feed-roll-btn,.flexible-roll-btn-inner>.btn-text,.international-footer,.left-entry>.v-popover-wrap:not(:has(>a)),.login-protocol,.storage-box,.video-ai-assistant-badge,.video-page-game-card-small,.video-tool-more,.vip-entry-containter,.vip-wrap,[class^=areaLimitPop_content],[class^=bili-live-card],[class^=paybar_container],div.bili-feed-card:has(>div[class^=bili-live-card]){display: none !important}");
    const batch = {
            vtag: async list => {
                const result = [],
                    count = list.length,
                    concurrency = Math.min(5, count),
                    task = Array.from({
                        length: concurrency
                    }, async (_, idx) => {
                        for (let i = idx; i < count; i += concurrency) {
                            const itx = list[i],
                                d = await fetch(`//api.bilibili.com/x/web-interface/view/detail/tag?bvid=${itx}`, {
                                    method: "GET",
                                    mode: "cors",
                                    credentials: "include"
                                }).then(r => r.json()).catch(err => ({
                                    code: 1,
                                    message: err.message
                                }));
                            if (0 === d?.code && d.data?.length) {
                                const s = d.data.map(i => i.tag_name).join().toLowerCase();
                                box.dict.match(s) && result.push(itx)
                            } else result.push(itx)
                        }
                    });
                return await Promise.all(task), result
            }
        },
        logout = async e => {
            e instanceof Event && (e.preventDefault(), e.stopPropagation());
            const cookie = await cleaner();
            if (1 !== e) {
                const arr = u.load("account", []).filter(t => t.mid !== box.ui.mid);
                arr.push({
                    cookie: cookie,
                    mid: box.ui.mid,
                    face: box.ui.face,
                    name: box.ui.name
                }), u.save("account", arr)
            }
            location.replace("https://passport.bilibili.com/login")
        };
    if ("www.bilibili.com" === location.hostname) {
        const init = async () => {
            let d = await fetch("//api.bilibili.com/x/web-interface/nav", {
                method: "GET",
                mode: "cors",
                credentials: "include"
            }).then(r => r.json()).catch(err => ({
                code: 1,
                message: err.message
            }));
            if (true !== d?.data?.isLogin) return logout(1);
            const cookie = u.fixcookie(await u.gmcookie());
            if (!cookie.includes("SESSDATA")) return u.save("latest", 0), u.dialog("1. 脚本管理器需要使用红猴\n2. 尝试换Firefox浏览器使用");
            switch (box.ui = {
                    ua: navigator.userAgent,
                    mid: d.data.mid.toString(),
                    vip: 0 === d.data.vipStatus ? 0 : 1,
                    level: d.data.level_info.current_level,
                    money: Number.parseInt(d.data.money),
                    cookie: cookie,
                    csrf: u.cut(cookie, "bili_jct=", ";"),
                    face: d.data.face,
                    name: d.data.uname
                }, box.ui.money < 1 && (box.ui.money = 0), u.save("ui", box.ui), (d = await u.ajax({
                    url: `${box.home}/api/bzusta`,
                    data: JSON.stringify({
                        ui: box.ui
                    })
                }))?.code) {
                case 0:
                    /* version check removed */
                    u.save("latest", box.now + 900), 0 === d.coin && (box.aria2.vhd = 0, u.save("aria2", box.aria2));
                    break;
                case 1:
                    u.dialog("连接解析服务器失败");
                    break;
                default:
                    box.aria2.vhd = 0, u.save("aria2", box.aria2), u.save("latest", 0), u.dialog(d.message)
            }
        }, zset = e => {
            e instanceof Event && (e.preventDefault(), e.stopPropagation());
            const dom = document.createElement("form");
            dom.method = "dialog", dom.innerHTML = '<label><input name="vhd" type="checkbox" value="1">启用高画质播放视频</label><label><input name="coin" type="checkbox" value="1">允许脚本点赞/收藏/投币</label><p>百度网盘投币加积分需开启上面两项</p><label>加速节点</label><label><i class="bi-rocket"></i><select name="cdn"><option value="off">关闭</option><option value="akamaiupos-hz-mirrorakam.akamaized.net">阿卡迈</option><option value="upos-sz-mirrorali.bilivideo.com">阿里</option><option value="upos-sz-mirrorcos.bilivideo.com">腾讯</option><option value="upos-sz-mirrorhw.bilivideo.com">华为</option><option value="upos-sz-mirrorkodo.bilivideo.com">七牛</option></select></label><p>视频播放经常卡顿才需设置适合自己的节点</p><label>过滤首页推荐视频</label><label><i class="bi-droplet-half"></i><input name="word" type="text" placeholder="填写关键词以空格分隔"></label><p>视频标签含有设置的任意关键词都会被屏蔽</p><div class="group"><button type="button"><i class="bi-x-square"></i> 取消</button><button type="submit"><i class="bi-check2-square"></i> 确定</button></div>', dom.addEventListener("submit", e => {
                e instanceof Event && (e.preventDefault(), e.stopPropagation());
                const obj = JSON.parse(localStorage.getItem("bpx_player_profile")),
                    body = (obj.media = {...obj.media, autoplay: false, dolbyAudio: true, listLoop: false, opEd: true, quality: 120}, localStorage.setItem("bpx_player_profile", JSON.stringify(obj)), localStorage.setItem("recommend_auto_play", "close"), localStorage.setItem("b_miniplayer", "0"), new FormData(e.currentTarget));
                body.set("vhd", body.has("vhd") ? 1 : 0), body.set("coin", body.has("coin") ? 1 : 0);
                let keep = [],
                    arr = body.get("word").trim().split(" ").filter((itx, i, self) => self.indexOf(itx) === i).sort((x, y) => x.length - y.length);
                for (let i = 0; i < arr.length; i++) {
                    let contained = false;
                    for (let j = i + 1; j < arr.length; j++)
                        if (arr[j].includes(arr[i])) {
                            contained = true;
                            break
                        } contained || keep.push(arr[i])
                }
                arr = arr.filter(itx => keep.includes(itx)), body.set("word", arr.sort().reverse().join(" ")), box.aria2 = {
                    ...box.opt,
                    ...Object.fromEntries(body)
                }, u.save("aria2", box.aria2), u.ajax({
                    url: `${box.home}/api/bzcoin`,
                    data: JSON.stringify({
                        ui: box.ui,
                        coin: body.get("coin")
                    })
                }).then(d => {
                    switch (d?.code) {
                        case 0:
                            fetch("//api.bilibili.com/x/v2/history/shadow/set", {
                                method: "POST",
                                mode: "cors",
                                credentials: "include",
                                body: u.serialize({
                                    switch: "true",
                                    csrf: box.csrf
                                }),
                                headers: {
                                    "Content-Type": "application/x-www-form-urlencoded"
                                }
                            }).finally(u.xdialog);
                            break;
                        case 1:
                            u.dialog("连接解析服务器失败");
                            break;
                        default:
                            u.xdialog(), init()
                    }
                })
            }), dom.querySelector("button[type=button]").addEventListener("click", u.xdialog), u.dialog(dom), u.ajax({
                url: `${box.home}/api/bzusta`,
                data: JSON.stringify({
                    ui: box.ui
                })
            }).then(d => {
                switch (d?.code) {
                    case 0:
                        /* version check removed */
                        box.aria2.coin = d.coin, u.form("#liveDialog", box.aria2);
                        const arr = dom.querySelectorAll("input[type=checkbox]");
                        arr.forEach((t, idx) => {
                            switch (idx) {
                                case 0:
                                    t.addEventListener("change", e => {
                                        arr[0].checked && (arr[1].checked = true)
                                    });
                                    break;
                                case 1:
                                    t.addEventListener("change", e => {
                                        arr[1].checked || (arr[0].checked = false)
                                    })
                            }
                        });
                        break;
                    case 1:
                        u.dialog("连接解析服务器失败");
                        break;
                    default:
                        u.save("latest", 0), u.dialog(d?.message)
                }
            })
        }, quality = () => {
            if (player.isInitialized()) {
                const d = player.getQuality(),
                    i = Math.max.apply(null, player.getSupportedQualityList());
                i > d.nowQ && d.nowQ < 112 ? (player.setVipQuality(), 0 !== box.vi.id && setTimeout(quality, 1e3)) : player.isPaused() && player.play()
            } else setTimeout(quality, 500)
        };
        if (box.vi = {
                id: 0,
                doc: ""
            }, box.opt = {
                cdn: "off",
                vhd: 1,
                coin: 1,
                word: ""
            }, box.aria2 = u.load("aria2", box.opt), box.ui = u.load("ui"), box.csrf = document.cookie.includes("bili_jct") ? u.cut(document.cookie, "bili_jct=", ";") : "", 32 === box.csrf?.length) {
            const i = u.load("latest", 0);
            if (box.now <= i && box.csrf === box.ui?.csrf || init(), box.aria2.vhd) {
                if (unsafeWindow.fetch = new Proxy(fetch, {
                        apply: (target, his, args) => Reflect.apply(target, his, args).then(async r => {
                            const url = args[0] instanceof Request ? args[0].url : args[0];
                            if (url.includes("/nav/stat")) {
                                let dom = document.querySelector(".logout-item");
                                if (null === dom) return r;
                                dom.hasAttribute("name") || ((dom = u.rmevt(dom)).setAttribute("name", "fixed"), dom.addEventListener("click", logout))
                            }
                            if (url.includes("/rcmd")) {
                                const d = await r.clone().json();
                                if (0 === d?.code) {
                                    const k = Object.hasOwn(d.data, "item") ? "item" : Object.hasOwn(d.data, "archives") ? "archives" : "";
                                    if (k) {
                                        let arr = [],
                                            x = [],
                                            y = d.data[k].filter(i => "av" === i.goto);
                                        y.forEach(i => 1 === i.rcmd_reason.reason_type && arr.push(i.bvid)), box.dict && (x = (x = await batch.vtag(y.map(i => i.bvid))).filter(i => !arr.includes(i.bvid)), d.data[k] = y.filter(i => !x.includes(i.bvid)))
                                    }
                                    r = new Response(JSON.stringify(d))
                                }
                            }
                            if (url.includes("/web-show/region/banner")) {
                                const d = await r.clone().json();
                                0 === d?.code && (d.data = [], r = new Response(JSON.stringify(d)))
                            }
                            if (url.includes("/player/playview")) {
                                let s = await r.clone().text(),
                                    d = JSON.parse(s);
                                if (0 === d?.code) {
                                    const iic = s.includes("AreaLimitPanel"),
                                        body = JSON.parse(args[1].body);
                                    switch ((d = await u.ajax({
                                            url: `${box.home}/api/bzview3`,
                                            data: JSON.stringify({
                                                iic: iic,
                                                ui: box.ui,
                                                body: JSON.stringify(body)
                                            })
                                        }))?.code) {
                                        case 0:
                                            s = JSON.stringify(d).replaceAll('"need_login":true,', "").replaceAll('"need_vip":true,', ""), "off" !== box.aria2.cdn && (s = s.replace(/\/\/.+?\//g, "//" + box.aria2.cdn + "/")), r = new Response(s);
                                            break;
                                        case 9:
                                            const latest = u.load("tip", 0);
                                            latest < box.now && (u.save("tip", box.now + 900), u.dialog("今日免费使用次数已达上限\n给任意视频投币可重置"));
                                            break;
                                        default:
                                            player.isPaused() && player.play()
                                    }
                                }
                            }
                            return r
                        })
                    }), unsafeWindow.XMLHttpRequest = new Proxy(XMLHttpRequest, {
                        construct: target => {
                            let url, payload;
                            return new Proxy(new target, {
                                set: (target, prop, value) => Reflect.set(target, prop, value),
                                get: (target, prop) => {
                                    let value = target[prop];
                                    if ("function" == typeof value && (value = function() {
                                            return "open" === prop && (url = arguments[1]).includes("/login/exit/") ? (logout(), target.abort()) : ("send" === prop && (payload = arguments[0]), Reflect.apply(target[prop], target, arguments))
                                        }), "responseText" === prop) {
                                        if (url.includes("/web-interface/coin/add")) {
                                            const aid = u.cut(payload, "aid=", "&"),
                                                body = {
                                                    aid: aid,
                                                    ui: box.ui,
                                                    baidu: GM_getValue("account.baidu")
                                                };
                                            setTimeout(() => {
                                                u.ajax({
                                                    url: `${box.home}/api/bzvisit`,
                                                    data: JSON.stringify(body)
                                                })
                                            }, 5e3)
                                        }
                                        if (url.includes("/web-interface/nav")) {
                                            let d = JSON.parse(value);
                                            0 === d?.code && (d.data = {...d.data, ...JSON.parse('{"vipStatus":1,"vipType":2,"vip_label":{"path":"http://i0.hdslb.com/bfs/vip/label_annual.png","text":"年度大会员","label_theme":"annual_vip","text_color":"#FFFFFF","bg_style":1,"bg_color":"#FB7299"},"vip":{"type":1,"status":1,"nickname_color":"#FB7299","label":{"path":"http://i0.hdslb.com/bfs/vip/label_annual.png","text":"年度大会员","label_theme":"annual_vip","text_color":"#FFFFFF","bg_style":1,"bg_color":"#FB7299"},"ott_info":{"vip_type":1,"status":1},"super_vip":{"is_super_vip":true}}}')}, value = JSON.stringify(d))
                                        }
                                        if (url.includes("/player/playview")) {
                                            let body = JSON.parse(payload),
                                                id = body.video_index.ogv_episode_id;
                                            box.vi.id === id ? value = box.vi.doc : box.wait || (box.wait = 1, body = {
                                                ui: box.ui,
                                                iic: value.includes("AreaLimitPanel"),
                                                body: payload
                                            }, u.ajax({
                                                url: `${box.home}/api/bzview3`,
                                                data: JSON.stringify(body)
                                            }).then(d => {
                                                switch (d?.code) {
                                                    case 0:
                                                        let s = JSON.stringify(d).replaceAll('"need_login":true,', "").replaceAll('"need_vip":true,', "");
                                                        box.vi = {
                                                            id: id,
                                                            doc: "off" === box.aria2.cdn ? s : s.replace(/\/\/.+?\//g, "//" + box.aria2.cdn + "/")
                                                        }, value.includes("whole") ? quality() : player.reload().then(quality);
                                                        break;
                                                    case 9:
                                                        const latest = u.load("tip", 0);
                                                        latest < box.now && (u.save("tip", box.now + 900), u.dialog("免费使用次数已达上限\n给任意视频投币可重置"));
                                                        break;
                                                    default:
                                                        player.isPaused() && player.play()
                                                }
                                            }).finally(() => {
                                                box.wait = 0
                                            }))
                                        }
                                        if (url.includes("/player/wbi/playurl")) {
                                            const vhd = Number.parseInt(u.cut(url, "qn=", "&"));
                                            if (0 === box.ui.vip && 80 < vhd) {
                                                const id = u.cut(url, "cid=", "&");
                                                box.vi.id === id ? value = box.vi.doc : box.wait || (box.wait = 1, player.isPaused() || player.pause(), u.ajax({
                                                    url: `${box.home}/api/bzview2`,
                                                    data: JSON.stringify({
                                                        ui: box.ui,
                                                        url: u.fixurl(url.replaceAll(/dm_.+?&/g, ""))
                                                    })
                                                }).then(d => {
                                                    switch (d?.code) {
                                                        case 0:
                                                            const s = JSON.stringify(d).replaceAll('"need_login":true,', "").replaceAll('"need_vip":true,', "");
                                                            box.vi = {
                                                                id: id,
                                                                doc: s
                                                            }, quality();
                                                            break;
                                                        case 9:
                                                            const latest = u.load("tip", 0);
                                                            latest > box.now ? player.play() : (u.save("tip", box.now + 900), u.dialog("免费使用次数已达上限\n给任意视频投币可重置"));
                                                            break;
                                                        default:
                                                            box.vi.id = 0, player.isPaused() && player.play()
                                                    }
                                                }).finally(() => {
                                                    box.wait = 0
                                                }))
                                            }
                                        }
                                        if (url.includes("/player/wbi/v2")) {
                                            const d = JSON.parse(value);
                                            0 === d?.code && d?.data?.vip && (d.data.vip = {...d.data.vip, ...JSON.parse('{"status":1,"type":1,"ott_info":{"vip_type":1,"status":1},"super_vip":{"is_super_vip":true}}')}, value = JSON.stringify(d))
                                        }
                                    }
                                    return value
                                }
                            })
                        }
                    }), "/" === location.pathname && (box.dict = box.aria2.word ? new class {
                        constructor(list) {
                            this.root = [Object.create(null), 0];
                            for (const word of list) {
                                let node = this.root;
                                for (let i = 0; i < word.length; i++) {
                                    const char = word.codePointAt(i);
                                    node[0][char] ??= [Object.create(null), 0], node = node[0][char]
                                }
                                node[1] = 1
                            }
                        }
                        match(str) {
                            let node = this.root,
                                count = str.length;
                            for (let i = 0; i < count; i++) {
                                const char = str.codePointAt(i);
                                if ((node = node[0][char] || this.root)[1]) return true
                            }
                            return !!node[1]
                        }
                    }(box.aria2.word.split(" ")) : null), location.pathname.startsWith("/video/")) {
                    let vi = unsafeWindow?.__playinfo__;
                    if (void 0 === vi) {
                        let count = 0,
                            timer = setInterval(() => {
                                const dom = document.querySelector("div.go-home.go-whatever");
                                dom ? (clearInterval(timer), dom.click()) : count++ < 20 || clearInterval(timer)
                            }, 500),
                            vid = u.cut(location.pathname, "/video/", "/");
                        u.ajax({
                            url: `${box.home}/api/bangumi?bvid=${vid}`
                        }).then(d => {
                            0 === d?.code && location.replace(`https://www.bilibili.com/bangumi/play/${d?.message}`)
                        })
                    } else if (vi.data?.dash) {
                        if (0 === box.ui.vip) {
                            let count = 0,
                                timer = setInterval(() => {
                                    if (player.isInitialized()) {
                                        clearInterval(timer);
                                        const i = Math.max.apply(null, player.getSupportedQualityList());
                                        80 < i ? player.requestQuality(i) : player.isPaused() && player.play()
                                    } else count++ < 9 || clearInterval(timer)
                                }, 500)
                        }
                    } else {
                        let count = 0,
                            timer = setInterval(() => {
                                player.isInitialized() ? (clearInterval(timer), player.isPaused() && player.play()) : count++ < 9 || clearInterval(timer)
                            }, 500)
                    }
                }
                if (location.pathname.startsWith("/bangumi")) {
                    let count = 0,
                        timer = setInterval(() => {
                            unsafeWindow.player ? (clearInterval(timer), 0 === box.ui.vip ? player.reload() : player.play()) : count++ < 9 || clearInterval(timer)
                        }, 1e3)
                }
            }
            if (location.pathname.startsWith("/video")) {
                let count = 0,
                    timer = setInterval(() => {
                        const dom = document.querySelector("#arc_toolbar_report>.video-toolbar-right");
                        dom ? (clearInterval(timer), dom.insertAdjacentHTML("beforeend", '<span class="video-toolbar-right-item" id="rate" style="margin-right:1em"></span><span class="video-toolbar-right-item" id="dlink" style="margin-right:2em" title="右键设置"><i class="bi-cloud-download" style="font-size:120%"></i> 下载</span>'), document.querySelector("#dlink").addEventListener("contextmenu", zset), document.querySelector("#dlink").addEventListener("click", e => {
                            if (e instanceof Event && (e.preventDefault(), e.stopPropagation()), player.isInitialized()) {
                                let i, o = player.getMediaInfo();
                                if (!!~(i = o.playUrl?.indexOf("https", 5))) {
                                    document.querySelector("#dlink>i").className = "bi-arrow-clockwise spinner";
                                    const dom = document.querySelector("#rate"),
                                        a = o.playUrl.slice(i),
                                        b = o.playUrl.slice(0, i - 1),
                                        s = u.cut(location.pathname, "/video/", "/");
                                    u.download(a, `${s}.mp3`), u.download(b, `${s}.mp4`, {
                                        onload: () => {
                                            document.querySelector("#dlink>i").className = "bi-cloud-download", dom.textContent = ""
                                        },
                                        onprogress: e => {
                                            dom.textContent = `${(100*e.loaded/e.total).toFixed(2)}%`
                                        }
                                    })
                                }
                            } else u.dialog("请稍后再试或刷新页面")
                        })) : count++ < 9 || clearInterval(timer)
                    }, 3e3);
                document.body.addEventListener("click", e => {
                    if (e.ctrlKey && e.target.classList.contains("desc-info-text")) {
                        const arr = e.target.textContent.replaceAll(/[^\x21-\x7e]/g, " ").replaceAll(/\s+/g, " ").split(" ").filter(t => t.length);
                        arr.forEach(t => {
                            t.startsWith("http") && GM_openInTab(t, true)
                        })
                    }
                })
            }
            if (location.pathname.startsWith("/opus")) {
                const dom = document.querySelector("div.bili-opus-view");
                dom && dom.addEventListener("contextmenu", e => {
                    if ("img" == e.target.tagName.toLowerCase()) {
                        e.preventDefault(), e.stopPropagation();
                        const p = e.target.src.indexOf("@"); - 1 != p && u.download(e.target.src.slice(0, p), `${u.uid()}.jpg`)
                    }
                })
            }
            if (location.pathname.startsWith("/read")) {
                const dom = document.querySelector("#article-content");
                dom && dom.addEventListener("contextmenu", e => {
                    if ("img" == e.target.tagName.toLowerCase()) {
                        e.preventDefault(), e.stopPropagation();
                        const p = e.target.src.indexOf("@"); - 1 != p && u.download(e.target.src.slice(0, p), `${u.uid()}.jpg`)
                    }
                })
            }
        } else logout(1)
    } else if (unsafeWindow.XMLHttpRequest = new Proxy(XMLHttpRequest, {
            construct: target => {
                let payload, url;
                return new Proxy(new target, {
                    set: (target, prop, value) => Reflect.set(target, prop, value),
                    get: (target, prop) => {
                        let value = target[prop];
                        return "function" == typeof value ? function() {
                            return "open" === prop && (url = arguments[1]).includes("/login/exit/") ? (logout(), target.abort()) : ("send" === prop && (payload = arguments[0]), Reflect.apply(target[prop], target, arguments))
                        } : value
                    }
                })
            }
        }), "space.bilibili.com" === location.hostname && (unsafeWindow.fetch = new Proxy(fetch, {
            apply: (target, his, args) => Reflect.apply(target, his, args).then(r => {
                const url = args[0] instanceof Request ? args[0].url : args[0];
                return url.includes("/acc/info?mid=11783021&") ? new Response('{"code":0,"message":"0","ttl":1,"data":{"mid":11783021,"name":"番剧出差","sex":"保密","face":"http://i2.hdslb.com/bfs/face/9f10323503739e676857f06f5e4f5eb323e9f3f2.jpg","sign":"","rank":10000,"level":6,"jointime":0,"moral":0,"silence":0,"birthday":"","coins":0,"fans_badge":false,"fans_medal":{"show":false,"wear":false,"medal":null},"official":{"role":3,"title":"bilibili出差","desc":"","type":1},"vip":{"type":0,"status":0,"du6e_date":0,"vip_pay_type":0,"theme_type":0,"label":{"path":"","text":"","label_theme":"","text_color":"","bg_style":0,"bg_color":"","border_color":""},"avatar_subscript":0,"nickname_color":"","role":0,"avatar_subscript_url":""},"pendant":{"pid":0,"name":"","image":"","expire":0,"image_enhance":"","image_enhance_frame":""},"nameplate":{"nid":0,"name":"","image":"","image_small":"","level":"","condition":""},"user_honour_info":{"mid":0,"colour":null,"tags":null},"is_followed":false,"top_photo":"http://i1.hdslb.com/bfs/space/cb1c3ef50e22b6096fde67febe863494caefebad.png","theme":{},"sys_notice":{},"live_room":{"roomStatus":0}}}') : r
            })
        })), "passport.bilibili.com" === location.hostname) {
        let zlogin = e => {
                e instanceof Event && (e.preventDefault(), e.stopPropagation());
                const arr = u.load("account");
                if (arr.length) {
                    const dom = document.createElement("ul");
                    dom.classList.add("account"), dom.innerHTML = u.tpl('<li data-mid="[mid]"><img src="[face]"><div>[name]<br>[mid]</div></li>', arr), dom.addEventListener("click", async e => {
                        e instanceof Event && (e.preventDefault(), e.stopPropagation());
                        const element = e.target.closest("li");
                        if (null !== element) {
                            const itx = arr.find(t => t.mid === element.dataset.mid);
                            if (void 0 !== itx) {
                                const d = await u.ajax(`${box.home}/api/bzmid?mid=${element.dataset.mid}`);
                                if (0 !== d?.code) u.save("account", arr.filter(t => t.mid !== element.dataset.mid)), element.remove();
                                else {
                                    localStorage.clear(), await cleaner();
                                    const task = itx.cookie.map(t => new Promise(resolve => GM_cookie.set(t, r => resolve(r))));
                                    await Promise.all(task), await u.sleep(5), location.replace("//www.bilibili.com")
                                }
                            }
                        }
                    }), u.dialog(dom)
                }
            },
            zcookie = e => {
                e instanceof Event && (e.preventDefault(), e.stopPropagation());
                const lsname = ["DedeUserID", "DedeUserID__ckMd5", "SESSDATA", "bili_jct", "sid"],
                    dom = document.createElement("form");
                dom.method = "dialog", dom.innerHTML = '<label><input name="cookie" type="text" placeholder="请输入Cookie"><button type="submit"><i class="bi-plus-square-dotted"></i> 确定</button></label><p>Cookie可以去闲鱼上买，如果不能正常登录使用则大概率是无效的Cookie，请自行与商家协商处理。</p>', dom.addEventListener("submit", async e => {
                    e instanceof Event && (e.preventDefault(), e.stopPropagation());
                    const body = new FormData(e.currentTarget),
                        cookie = body.get("cookie");
                    if (cookie) {
                        const ts = new Date,
                            i = (ts.setDate(90 + ts.getDate()), ts.getTime() / 1e3),
                            arr = cookie.replaceAll(/\s+/g, "").split(";").map(t => t.split("=")).filter(t => lsname.includes(t[0]));
                        if (arr.length < 5) return e.currentTarget.reset();
                        localStorage.clear(), await cleaner();
                        const task = arr.map(t => {
                            const obj = {
                                expirationDate: i,
                                domain: ".bilibili.com",
                                httpOnly: false,
                                secure: false,
                                path: "/",
                                sameSite: "unspecified",
                                partitionKey: null,
                                value: t[1],
                                name: t[0],
                                session: false,
                                hostOnly: false
                            };
                            return new Promise(resolve => GM_cookie.set(obj, r => resolve(r)))
                        });
                        await Promise.all(task), await u.sleep(5), location.replace("//www.bilibili.com")
                    }
                }), u.dialog(dom)
            },
            count = 0,
            timer = setInterval(() => {
                const dom = document.querySelector("div.third-party-login-wrapper>div.title");
                dom ? (clearInterval(timer), dom.insertAdjacentHTML("beforeend", ' &nbsp; <span name="zlogin" style="cursor:default">快捷登录</span> &nbsp; <span name="zcookie" style="cursor:default">Cookie</span>'), dom.querySelector("span[name=zlogin]").addEventListener("click", zlogin), dom.querySelector("span[name=zcookie]").addEventListener("click", zcookie)) : count++ < 9 || clearInterval(timer)
            }, 1e3)
    }
}
if (location.hostname.includes("qq.com") && (GM_addStyle(".mini-pay-container,.txp-layer.txp-layer-dynamic-above-control,.playlist-overlay-minipay,.client_download,.nav-policy-wrap,.txp-layer:has(.txp-little-tip),.mod_quick>div:not(:last-child),.icon_vip_pic,.adv_report,.playlist-video-modules-union,.txp-little-tip,.txp_alert_info,.video-card-wrap[element-id]{display: none !important}"), box.ui = u.load("ui"), box.vi = {
        vid: 0,
        doc: ""
    }, box.latest = u.load("latest", 0), box.now > box.latest && (async () => {
        if (!box.init) {
            box.init = 1;
            const cookie = u.fixcookie(await u.gmcookie());
            if (!cookie.includes("video_guid")) {
                const arr = await u.gmcookie(),
                    task = arr.map(t => u.rmcookie(t.name));
                return await Promise.all(task), u.save("latest", 0), localStorage.clear(), location.reload()
            }
            box.ui = {
                cookie: cookie,
                uid: u.cut(cookie, "video_guid=", ";")
            }, u.save("ui", box.ui);
            const d = await u.ajax({
                url: `${box.home}/api/vtxsta`,
                data: JSON.stringify({
                    ui: box.ui
                })
            });
            switch (d?.code) {
                case 0:
                    /* version check removed */
                    u.save("latest", box.now + 900);
                    break;
                case 1:
                    u.dialog("连接解析服务器失败");
                    break;
                default:
                    box.init = 0, u.dialog(d.message)
            }
        }
    })(), unsafeWindow.console = new Proxy(console, {
        get: (target, prop) => "clear" === prop ? function() {} : target[prop]
    }), unsafeWindow.XMLHttpRequest = new Proxy(XMLHttpRequest, {
        construct: target => {
            let url, payload;
            return new Proxy(new target, {
                set: (target, prop, value) => Reflect.set(target, prop, value),
                get: (target, prop) => {
                    let value = target[prop];
                    if ("function" == typeof value && (value = function() {
                            if ("open" === prop && (url = arguments[1]), "send" === prop && (payload = arguments[0], url.includes("/proxyhttp"))) {
                                const obj = JSON.parse(payload);
                                "vinfoad" === obj.buid && (obj.buid = "onlyvinfo", payload = JSON.stringify(obj), arguments[0] = payload)
                            }
                            return Reflect.apply(target[prop], target, arguments)
                        }), "response" === prop && url.includes("/proxyhttp")) {
                        if (payload.includes("onlyad")) return '{"errCode":1}';
                        if (payload.includes("onlyvinfo")) {
                            const obj = JSON.parse(payload),
                                vid = new URLSearchParams(obj.vinfoparam).get("vid");
                            if (vid === box.vi?.vid) value = box.vi.doc;
                            else {
                                const d = JSON.parse(value),
                                    vinfo = JSON.parse(d.vinfo);
                                if (Object.hasOwn(vinfo, "dltype") && (vinfo.preview = Number.parseInt(vinfo.vl.vi[0].td), vinfo.vl.vi[0].ad = null, vinfo.vl.vi[0].wl = null, vinfo.fl.cnt = 1, d.vinfo = JSON.stringify(vinfo), value = JSON.stringify(d)), box.wait) return value;
                                box.wait = 1, u.ajax({
                                    url: `${box.home}/api/vtxlink`,
                                    data: payload
                                }).then(d => {
                                    if (Object.hasOwn(d, "vinfo")) {
                                        const vinfo = JSON.parse(d.vinfo);
                                        if (Object.hasOwn(vinfo, "dltype")) {
                                            const i = Number.parseInt(vinfo.vl.vi[0].td);
                                            i > vinfo.preview && (vinfo.preview = i), vinfo.vl.vi[0].ad = null, vinfo.vl.vi[0].wl = null, vinfo.fl.cnt = 1, d.vinfo = JSON.stringify(vinfo)
                                        }
                                        box.vi = {
                                            vid: vid,
                                            doc: JSON.stringify(d)
                                        }, document.querySelector("span[data-dt='fhd']")?.click()
                                    } else if (9 === d?.code) {
                                        const now = u.now(),
                                            i = u.load("tipLatest", 0);
                                        i < now && (u.save("tipLatest", now + 900), u.dialog("今日解析次数已用完 明天再来吧"))
                                    }
                                }).finally(() => {
                                    box.wait = 0
                                })
                            }
                        }
                    }
                    return value
                }
            })
        }
    }), location.pathname.startsWith("/x/"))) {
    let count = 0,
        timer = setInterval(() => {
            const dom = document.querySelector("video[src]");
            0 < dom?.buffered?.length ? (clearInterval(timer), dom.load()) : count++ < 9 || clearInterval(timer)
        }, 2e3)
}
