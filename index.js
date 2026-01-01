const { 
    Client, GatewayIntentBits, EmbedBuilder, ChannelType, 
    PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors()); 
app.use(express.json());

// الاتصال السريع بقاعدة البيانات
mongoose.connect(process.env.MONGO_URI).catch(() => {});

const StoreSchema = new mongoose.Schema({ configId: String, products: Array, customBgs: Object });
const Store = mongoose.model('Store', StoreSchema);

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers]
});

const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// --- فتح التذكرة بسرعة البرق ---
app.post('/open-ticket', async (req, res) => {
    // 1. رد فوراً على الموقع
    res.send({ success: true });

    // 2. معالجة ديسكورد في الخلفية
    try {
        const { productName, buyerId, qty, total } = req.body;
        const guild = client.guilds.cache.get(GUILD_ID);
        if (!guild) return;

        // جلب العضو من الكاش أو السيرفر بأسرع طريقة
        const member = await guild.members.fetch(buyerId.trim()).catch(() => null);
        if (!member) return;

        // إنشاء القناة (أولوية قصوى)
        const channel = await guild.channels.create({
            name: `ticket-${member.user.username}`,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
            content: `طلب جديد: <@${member.id}> | <@&${ADMIN_ROLE_ID}>`,
            embeds: [new EmbedBuilder().setTitle('🛒 تفاصيل الطلب').setDescription(`**المنتج:** ${productName}\n**الكمية:** ${qty}\n**الإجمالي:** ${total}`).setColor('#D4AF37')],
            components: [row]
        });
    } catch (e) { console.error("Create Error:", e); }
});

// --- حل نهائي لمشكلة زر الإغلاق ---
client.on('interactionCreate', async (i) => {
    if (!i.isButton()) return;

    if (i.customId === 'close_ticket') {
        try {
            // "deferUpdate" ينهي انتظار ديسكورد فوراً ويمنع خطأ الـ Interaction
            await i.deferUpdate().catch(() => {}); 
            
            // حذف القناة فوراً
            await i.channel.delete().catch(() => {});
        } catch (error) {
            console.error("Close Error:", error);
        }
    }
});

client.login(process.env.TOKEN);
app.listen(process.env.PORT || 10000);
