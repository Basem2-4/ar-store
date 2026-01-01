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
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers 
    ]
});

const GUILD_ID = process.env.GUILD_ID;
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// 3. مسار إنشاء التذكرة (أقصى سرعة وأدق تفاصيل)
app.post('/api/create-ticket', async (req, res) => {
    const data = req.body;

    // جلب البيانات مع احتمالية اختلاف المسميات من الموقع
    const finalDiscordId = data.discordId || data.userId || data.user_id;
    const finalPrice = data.totalPrice || data.price || '0';
    const finalProduct = data.productName || data.item || data.product || 'غير محدد';
    const finalCategory = data.categoryName || data.category || 'عام';
    const finalQty = data.quantity || data.qty || 1;

    if (!finalDiscordId) return res.status(400).json({ success: false, error: 'Discord ID missing' });

    try {
        // تنفيذ العمليات بالتوازي لضمان أسرع فتح للتذكرة
        const [guild, orderId] = await Promise.all([
            client.guilds.cache.get(GUILD_ID) || client.guilds.fetch(GUILD_ID),
            Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq)
        ]);

        // جلب العضو والتأكد من وجوده لتجنب خطأ PermissionOverwrites
        const member = await guild.members.fetch(finalDiscordId.trim()).catch(() => null);
        if (!member) return res.status(404).json({ success: false, error: 'Member not found in server' });

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
                { name: 'قسم الطلب', value: `${finalCategory}`, inline: true },
                { name: 'المنتج المطلوب', value: `${finalProduct} النسخ ${finalQty}`, inline: false },
                { name: 'الإجمالي', value: `${finalPrice}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        // إرسال الرسالة بدون أزرار (يتم الحذف يدوياً)
        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, 
            embeds: [embed] 
        });

        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ خطأ أثناء إنشاء التذكرة:', error.message);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag} 🤖 ✅`);
});

client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${port}`);
});
