const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
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
const LOG_CHANNEL_ID = "1324422204557004860"; 
const ADMIN_ROLE_ID = "1069269164667179109"; 

// 3. مسار إنشاء التذكرة (محسن للسرعة)
app.post('/api/create-ticket', async (req, res) => {
    const { discordId, totalPrice, categoryName, productName, quantity } = req.body;

    if (!discordId) return res.status(400).json({ success: false });

    try {
        // تنفيذ العمليات بالتوازي لتسريع الوقت
        const [guild, orderId] = await Promise.all([
            client.guilds.cache.get(GUILD_ID) || client.guilds.fetch(GUILD_ID),
            Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq)
        ]);

        const member = await guild.members.fetch(discordId.trim());

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
                { name: 'قسم الطلب', value: `${categoryName || 'غير محدد'}`, inline: true },
                { name: 'المنتج المطلوب', value: `${productName || 'غير محدد'} (x${quantity || 1})`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice || '0'}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, embeds: [embed], components: [row] });
        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ Error:', error.message);
        res.status(500).json({ success: false });
    }
});

// 4. نظام إغلاق التذكرة (تم إصلاح خطأ التفاعل وبطء الاستجابة)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'close_ticket') return;

    try {
        // الرد الفوري لإخبار ديسكورد أن البوت استلم الأمر (يحل مشكلة Unknown interaction)
        await interaction.reply({ content: '🔒 جاري معالجة الإغلاق والارشفة...', ephemeral: true });

        const logChannel = client.channels.cache.get(LOG_CHANNEL_ID) || await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
        
        const logEmbed = new EmbedBuilder()
            .setTitle('🔒 تذكرة مغلقة')
            .setColor('#ff0000')
            .addFields(
                { name: 'اسم التذكرة', value: `${interaction.channel.name}`, inline: true },
                { name: 'أغلقت بواسطة', value: `<@${interaction.user.id}>`, inline: true }
            )
            .setTimestamp();

        if (logChannel) await logChannel.send({ embeds: [logEmbed] });

        // التذكرة تُحذف بعد الرد مباشرة لضمان السرعة
        setTimeout(() => interaction.channel.delete().catch(() => {}), 2000);

    } catch (err) {
        console.error('Interaction Error:', err.message);
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Port ${port}`));
