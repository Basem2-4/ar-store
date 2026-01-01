const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require('discord.js');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// 1. الاتصال بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('Connected to MongoDB ✅'))
    .catch(err => console.error('MongoDB Connection Error ❌', err));

const Counter = mongoose.model('Counter', new mongoose.Schema({ id: String, seq: Number }));

// 2. إعداد البوت
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1069269164667179109"; 

// 3. مسار إنشاء التذكرة
app.post('/api/create-ticket', async (req, res) => {
    const data = req.body;

    // معالجة البيانات
    let productName = data.productName || data.item || data.product || data.title || "غير معروف";
    let quantity = data.quantity || data.qty || 1;
    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        productName = data.items.map(i => i.name || i.product_name || i.title).join(', ');
        quantity = data.items[0].quantity || data.items[0].qty || quantity;
    }

    const discordId = data.discordId || data.userId || data.user_id;
    const totalPrice = data.totalPrice || data.price || '0';
    const categoryName = data.categoryName || data.category || 'عام';

    if (!discordId) return res.status(400).json({ success: false });

    // الرد على المتجر فوراً (أهم خطوة لعدم التأخير في المرة الثانية)
    res.status(200).json({ success: true, message: "Processing started" });

    // تنفيذ باقي العمليات في الخلفية دون جعل المستخدم ينتظر
    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // استخدام الذاكرة المؤقتة للعضو أولاً لتجنب البطء
        let member = guild.members.cache.get(discordId.trim());
        if (!member) member = await guild.members.fetch(discordId.trim()).catch(() => null);

        if (!member) return console.log(`❌ Member ${discordId} not found`);

        const orderId = await Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq);

        const channel = await guild.channels.create({
            name: `ticket-${orderId}`,
            type: 0,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('📦 طلب جديد - تم تأكيد الدفع')
            .setColor('#FFD700') 
            .setDescription(`أهلاً بك <@${member.id}>\nتم فتح هذه التذكرة لمتابعة طلبك مع الإدارة.`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'قسم الطلب', value: `${categoryName}`, inline: true },
                { name: 'التفاصيل', value: `${productName} النسخ ${quantity}`, inline: false },
                { name: 'الإجمالي', value: `${totalPrice}`, inline: false }
            )
            .setTimestamp();

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, embeds: [embed] });

    } catch (error) {
        console.error('❌ Background Error:', error.message);
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));
