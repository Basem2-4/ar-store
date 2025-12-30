const express = require('express');
const cors = require('cors');
const fs = require('fs');
const app = express();

app.use(cors());
app.use(express.json());

const DATA_FILE = './data.json';

// وظيفة لقراءة البيانات من الملف
const readData = () => {
    if (!fs.existsSync(DATA_FILE)) {
        return { products: [], coupons: [], backgrounds: {} };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE));
};

// وظيفة لحفظ البيانات في الملف
const saveData = (data) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
};

// 1. رابط جلب البيانات (يستخدمه المتصفح عند التحميل)
app.get('/get-data', (req, res) => {
    res.json(readData());
});

// 2. رابط حفظ البيانات (يستخدمه الأدمن عند الإضافة أو التعديل)
app.post('/save-data', (req, res) => {
    const newData = req.body;
    saveData(newData);
    res.json({ success: true, message: "تم الحفظ بنجاح للجميع" });
});

// 3. رابط فتح التذكرة (البوت)
app.post('/open-ticket', (req, res) => {
    console.log("طلب شراء جديد:", req.body);
    // هنا يمكنك إضافة كود إرسال الطلب لديسكورد عبر Webhook
    res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ ${PORT}`);
});