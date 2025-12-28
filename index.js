const BOT_URL = "https://ar-store-i6tw.onrender.com/open-ticket";
const rates = { "SR": 1, "USD": 0.27 };
let currentCurr = "SR";
let products = JSON.parse(localStorage.getItem('ar_store_v12')) || [];
let currentView = 'home';
let currentIndex = null;

// حركة المؤشر
const cursor = document.getElementById('custom-cursor');
document.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
});

function render() {
    const now = new Date().getTime();
    const bestGrid = document.getElementById('bestSellerGrid');
    const catGrid = document.getElementById('categoryGrid');
    const discSelect = document.getElementById('discProduct');
    
    bestGrid.innerHTML = ''; catGrid.innerHTML = '';
    discSelect.innerHTML = products.map((p, i) => `<option value="${i}">${p.name}</option>`).join('');

    products.forEach((p, i) => {
        let price = p.price;
        let hasDisc = (p.discount && p.discount.expiry > now);
        if (hasDisc) price = p.price - (p.price * (p.discount.percent / 100));

        const convPrice = (price * rates[currentCurr]).toFixed(2);
        const isAdmin = document.getElementById('adminSection').style.display === 'block';
        const isOut = p.stock <= 0;

        const cardHtml = `
            <div class="card ${isOut ? 'out-of-stock' : ''}">
                ${hasDisc ? `<div style="position:absolute;top:10px;right:10px;background:red;padding:2px 8px;border-radius:5px;font-size:12px;">خصم ${p.discount.percent}%</div>` : ''}
                <img src="${p.img || 'https://via.placeholder.com/300x160'}">
                <div class="card-content">
                    <h3>${p.name}</h3>
                    <div class="price">${convPrice} ${currentCurr}</div>
                    <p style="font-size:12px; color:gray;">المخزون: ${p.stock}</p>
                    <button class="buy-btn" ${isOut ? 'disabled' : ''} onclick="openOrder(${i})">
                        ${isOut ? 'نفذت الكمية' : 'اطلب الآن'}
                    </button>
                    ${isAdmin ? `
                        <div style="display:flex; gap:5px; margin-top:10px;">
                            <button onclick="editP(${i})" style="flex:1; background:#333; color:gold; border:none; padding:5px; border-radius:5px;">تعديل</button>
                            <button onclick="deleteP(${i})" class="del-btn">حذف</button>
                        </div>
                    ` : ''}
                </div>
            </div>`;

        if (currentView === 'home' && (hasDisc || p.stock < 5)) bestGrid.innerHTML += cardHtml;
        if (p.category === currentView) catGrid.innerHTML += cardHtml;
    });
}

// وظائف الإدارة
function saveProduct() {
    const idx = document.getElementById('editIndex').value;
    const p = {
        name: document.getElementById('pName').value,
        price: parseFloat(document.getElementById('pPrice').value),
        stock: parseInt(document.getElementById('pStock').value),
        img: document.getElementById('pImg').value,
        category: document.getElementById('pCategory').value,
        sales: 0
    };
    if(idx === "") products.push(p); else products[idx] = p;
    saveAll();
}

function applyDiscount() {
    const idx = document.getElementById('discProduct').value;
    const percent = document.getElementById('discPercent').value;
    const hours = document.getElementById('discHours').value;
    products[idx].discount = {
        percent: parseInt(percent),
        expiry: new Date().getTime() + (hours * 3600000)
    };
    saveAll();
    alert("تم تفعيل الخصم ✅");
}

function deleteP(i) { if(confirm("حذف المنتج؟")) { products.splice(i, 1); saveAll(); } }
function editP(i) {
    const p = products[i];
    document.getElementById('pName').value = p.name;
    document.getElementById('pPrice').value = p.price;
    document.getElementById('editIndex').value = i;
}

function saveAll() { localStorage.setItem('ar_store_v12', JSON.stringify(products)); render(); }
function openAdmin() { if(prompt("الباسورد:") === "admin123") { document.getElementById('adminSection').style.display = 'block'; render(); } }
function closeAdmin() { document.getElementById('adminSection').style.display = 'none'; render(); }

// وظائف المتجر
function showSection(s) { 
    currentView = s; 
    document.getElementById('homeSection').style.display = (s==='home'?'block':'none');
    document.getElementById('categorySection').style.display = (s==='home'?'none':'block');
    document.getElementById('categoryTitle').innerText = "قسم " + s;
    render(); 
}

function openOrder(i) { currentIndex = i; document.getElementById('orderModal').style.display = 'flex'; }
function closeModal() { document.getElementById('orderModal').style.display = 'none'; }
function goToPayment() { document.getElementById('modalMain').style.display = 'none'; document.getElementById('paymentScreen').style.display = 'flex'; }

async function finishOrder() {
    const p = products[currentIndex];
    const discord = document.getElementById('orderDiscord').value;
    const qty = document.getElementById('orderQty').value;
    const usage = document.getElementById('usageType').value;
    const btn = document.getElementById('finalBtn');

    if(!discord) return alert("اكتب ايدي ديسكوردك");

    btn.disabled = true; btn.innerText = "جاري فتح تذكرة...";

    try {
        const res = await fetch(BOT_URL, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                productName: p.name,
                buyerId: discord,
                qty: qty,
                total: (p.price * qty),
                usage: usage
            })
        });
        const result = await res.json();
        if(result.success) {
            p.stock -= qty; saveAll();
            alert("✅ تم فتح تذكرة بنجاح في الديسكورد!");
            location.reload();
        } else { alert("خطأ من السيرفر: " + result.error); }
    } catch(e) { alert("فشل الاتصال بالبوت."); }
    finally { btn.disabled = false; btn.innerText = "لقد قمت بالتحويل، افتح تذكرة ✅"; }
}

render();
setInterval(render, 10000); // تحديث العروض كل 10 ثواني
