const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// الإعدادات الخاصة بديسكورد
const DISCORD_WEBHOOK_URL = "ضع_هنا_رابط_الويب_هوك_الخاص_بك";

app.post('/open-ticket', async (req, res) => {
    const { productName, buyerId, qty, total, usage } = req.body;

    // تجهيز الرسالة التي ستظهر في ديسكورد
    const embed = {
        title: "طلب شراء جديد 🛒",
        color: 0xD4AF37, // اللون الذهبي
        fields: [
            { name: "المنتج", value: productName, inline: true },
            { name: "الكمية", value: qty.toString(), inline: true },
            { name: "الإجمالي", value: `${total} SR`, inline: true },
            { name: "المشتري (Discord ID)", value: buyerId },
            { name: "نوع الاستخدام", value: usage },
            { name: "الحالة", value: "بانتظار التحقق من الدفع ⏳" }
        ],
        timestamp: new Date()
    };

    try {
        await axios.post(DISCORD_WEBHOOK_URL, {
            content: `اشعار طلب جديد من: <@${buyerId}>`,
            embeds: [embed]
        });

        res.status(200).json({ success: true, message: "Ticket opened successfully" });
    } catch (error) {
        console.error("Error sending to Discord:", error);
        res.status(500).json({ success: false, error: "Failed to connect to Discord" });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
