const { 
    Client, GatewayIntentBits, EmbedBuilder, ChannelType, 
    PermissionFlagsBits, ButtonBuilder, ButtonStyle, ActionRowBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

// إعدادات المتغيرات
const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "ضع_هنا_ايدي_قناة_اللوق"; // قناة لمراقبة التذاكر
const ADMIN_ROLE_ID = "ضع_هنا_ايدي_رتبة_الادارة";

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        const guild = await client.guilds.fetch(GUILD_ID);
        
        let member;
        try {
            member = await guild.members.fetch(buyerId.toString().trim());
        } catch (e) {
            return res.status(400).json({ success: false, error: "العضو غير موجود في السيرفر" });
        }

        // 1. إنشاء قناة التذكرة
        const channel = await guild.channels.create({
            name: `طلب-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                { id: ADMIN_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ],
        });

        // 2. إعداد الزر والامبيد
        const closeBtn = new ButtonBuilder().setCustomId('close_t').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(closeBtn);

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🎫 تذكرة طلب جديدة')
            .setColor('#D4AF37')
            .addFields(
                { name: 'المنتج', value: productName, inline: true },
                { name: 'الكمية', value: qty.toString(), inline: true },
                { name: 'السعر الإجمالي', value: `${total} SR`, inline: true },
                { name: 'المشتري', value: `<@${member.id}>` }
            )
            .setTimestamp();

        await channel.send({ 
            content: `تنبيه الإدارة: <@&${ADMIN_ROLE_ID}> | تم فتح تذكرة بواسطة <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

        // 3. إرسال اللوق (Logging)
        const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
        if (logChannel) {
            const logEmbed = new EmbedBuilder()
                .setTitle('📝 سجل التذاكر (Log)')
                .setDescription(`تم فتح تذكرة جديدة:\n**القناة:** ${channel.name}\n**المشتري:** <@${member.id}>\n**المنتج:** ${productName}`)
                .setColor('#D4AF37')
                .setTimestamp();
            logChannel.send({ embeds: [logEmbed] });
        }

        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// معالج الأزرار
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'close_t') {
        await interaction.reply('سيتم إغلاق التذكرة الآن...');
        setTimeout(() => interaction.channel.delete().catch(() => {}), 3000);
    }
});

client.once('ready', () => console.log(`✅ ${client.user.tag} جاهز`));

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => console.log(`🚀 السيرفر يعمل`));

client.login(TOKEN);
