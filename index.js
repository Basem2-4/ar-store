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

    // --- معالجة ذكية لجلب اسم المنتج ---
    let productName = "غير محدد";
    let quantity = data.quantity || data.qty || 1;

    // 1. إذا كان المنتج داخل مصفوفة (الاحتمال الأكبر في المواقع)
    const items = data.items || data.products || data.cart;
    if (Array.isArray(items) && items.length > 0) {
        productName = items.map(i => `${i.name || i.productName || i.title || 'منتج'}`).join(', ');
        quantity = items[0].quantity || items[0].qty || quantity;
    } 
    // 2. إذا كان المنتج مرسل كاسم مباشر
    else {
        productName = data.productName || data.item || data.product || data.title || "منتج غير معروف";
    }

    const discordId = data.discordId || data.userId || data.user_id;
    const totalPrice = data.totalPrice || data.price || '0';
    const categoryName = data.categoryName || data.category || 'عام';

    if (!discordId) return res.status(400).json({ success: false, error: 'Discord ID missing' });

    try {
        const guild = client.guilds.cache.get(GUILD_ID) || await client.guilds.fetch(GUILD_ID);
        
        // تنفيذ العداد وجلب العضو بالتوازي
        const [orderId, member] = await Promise.all([
            Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq),
            guild.members.fetch(discordId.trim()).catch(() => null)
        ]);

        if (!member) return res.status(404).json({ success: false, error: 'User not found' });

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

        // الرد الفوري للموقع
        res.status(200).json({ success: true, channelId: channel.id });

        // إرسال الإمبد في الخلفية
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
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, embeds: [embed] });

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (!res.headersSent) res.status(500).json({ success: false });
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server on port ${port}`));
