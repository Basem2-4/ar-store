const { 
    Client, 
    GatewayIntentBits, 
    EmbedBuilder, 
    ChannelType, 
    PermissionFlagsBits, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder 
} = require('discord.js');
const express = require('express');
const cors = require('cors');

const app = express();

// تصحيح: تفعيل CORS بشكل يسمح للمتصفح بإرسال الطلبات بدون قيود
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// مسار رئيسي لـ Render (Health Check)
app.get('/', (req, res) => {
    res.status(200).send('Bot is running and healthy! 🚀');
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers, 
        GatewayIntentBits.MessageContent
    ]
});

const TOKEN = process.env.TOKEN; 
const GUILD_ID = process.env.GUILD_ID; 
const CATEGORY_ID = process.env.CATEGORY_ID; 
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

app.post('/open-ticket', async (req, res) => {
    try {
        const { productName, buyerId, qty, total, usage } = req.body;
        
        const guild = await client.guilds.fetch(GUILD_ID);
        
        let member;
        try {
            const cleanBuyerId = buyerId.toString().trim();
            member = await guild.members.fetch(cleanBuyerId);
        } catch (e) {
            console.error("خطأ في جلب العضو:", e.message);
            return res.status(400).json({ success: false, error: "العضو غير موجود في السيرفر أو الايدي خاطئ" });
        }

        const channel = await guild.channels.create({
            name: `طلب-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORY_ID,
            permissionOverwrites: [
                { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { 
                    id: member.id, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages, 
                        PermissionFlagsBits.ReadMessageHistory
                    ] 
                },
                { 
                    id: ADMIN_ROLE_ID, 
                    allow: [
                        PermissionFlagsBits.ViewChannel, 
                        PermissionFlagsBits.SendMessages
                    ] 
                }
            ],
        });

        const closeBtn = new ButtonBuilder()
            .setCustomId('close_ticket')
            .setLabel('إغلاق التذكرة')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🔒');

        const row = new ActionRowBuilder().addComponents(closeBtn);

        const ticketEmbed = new EmbedBuilder()
            .setTitle('🛒 تفاصيل طلب الشراء')
            .setColor('#D4AF37') 
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '👤 المشتري', value: `<@${member.id}>`, inline: true },
                { name: '📦 المنتج', value: productName, inline: true },
                { name: '🔢 الكمية', value: qty.toString(), inline: true },
                { name: '💰 الإجمالي', value: `${total} SR`, inline: true },
                { name: '📝 نوع الاستخدام', value: usage || 'غير محدد', inline: true }
            )
            .setFooter({ text: 'متجر AR - نظام التذاكر الآلي' })
            .setTimestamp();

        await channel.send({ 
            content: `تنبيه الإدارة: <@&${ADMIN_ROLE_ID}> | طلب جديد من <@${member.id}>`, 
            embeds: [ticketEmbed], 
            components: [row] 
        });

        try {
            const logChannel = await guild.channels.fetch(LOG_CHANNEL_ID);
            const logEmbed = new EmbedBuilder()
                .setTitle('📥 سجل إنشاء تذكرة')
                .setColor('#2ecc71') 
                .setDescription(`تم فتح تذكرة جديدة بواسطة <@${member.id}>`)
                .addFields(
                    { name: 'اسم القناة', value: `#${channel.name}` },
                    { name: 'المنتج', value: productName }
                )
                .setTimestamp();
            
            if (logChannel) await logChannel.send({ embeds: [logEmbed] });
        } catch (logErr) {
            console.error("فشل إرسال اللوق:", logErr.message);
        }

        res.json({ success: true, url: `https://discord.com/channels/${GUILD_ID}/${channel.id}` });

    } catch (error) {
        console.error("Internal Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;
    if (interaction.customId === 'close_ticket') {
        await interaction.reply({ content: '⚠️ سيتم إغلاق التذكرة وحذف القناة بعد 5 ثوانٍ...' });
        setTimeout(async () => {
            try {
                if (interaction.channel) await interaction.channel.delete();
            } catch (err) {
                console.error("فشل في حذف القناة:", err);
            }
        }, 5000);
    }
});

client.once('ready', () => {
    console.log(`✅ ${client.user.tag} متصل وجاهز للعمل!`);
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 السيرفر يعمل على المنفذ ${PORT}`);
});

client.login(TOKEN);
