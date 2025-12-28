const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField } = require('discord.js');
const express = require('express');
const cors = require('cors');

// --- إعدادات السيرفر والبوت ---
const TOKEN = "MTQ0ODE2MjI2ODYzMzEwODYwMA.GkijxC.NdE3ZLjL5pDzCrV5oV_Ju1ZiogAguhUkXOkaV4";
const GUILD_ID = "1433835382549774376";
const CATEGORY_ID = "1433835949405503591";
const ADMIN_ROLE_ID = "1433835949405503591";
const PORT = 3000;

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers 
    ] 
});

const app = express();
app.use(cors()); // للسماح للموقع بالاتصال بالبوت
app.use(express.json());

client.on('ready', () => {
    console.log(`✅ البوت شغال باسم: ${client.user.tag}`);
});

app.post('/open-ticket', async (req, res) => {
    const { productName, buyerId, qty, total, currency, usage } = req.body;

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) return res.status(404).json({ success: false, error: "السيرفر غير موجود" });

        // جلب العضو للتأكد من وجوده في السيرفر
        let member;
        try {
            member = await guild.members.fetch(buyerId.trim());
        } catch (e) {
            return res.status(400).json({ success: false, error: "العضو غير موجود في السيرفر" });
        }

        // إنشاء القناة
        const channel = await guild.channels.create({
            name: `ticket-${productName}-${member.user.username}`,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                { id: member.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
                { id: ADMIN_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory] },
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle('🛒 طلب شراء جديد')
            .setColor(0xD4AF37)
            .addFields(
                { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '💰 السعر الإجمالي', value: `${total} ${currency}`, inline: true },
                { name: '🎁 الغرض', value: usage, inline: true }
            )
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
            content: `مرحباً <@${member.id}> | <@&${ADMIN_ROLE_ID}>`, 
            embeds: [embed], 
            components: [row] 
        });

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: err.message });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (interaction.isButton() && interaction.customId === 'close_ticket') {
        await interaction.reply('سيتم الحذف خلال 5 ثوانٍ...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
    }
});

// تشغيل السيرفر على 0.0.0.0 ليقبل الاتصال من الجوال والأجهزة الأخرى
client.login(TOKEN);
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT} وجاهز للربط الخارجي`);
});