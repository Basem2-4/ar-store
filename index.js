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
const LOG_CHANNEL_ID = "1433835949405503591"; 
const ADMIN_ROLE_ID = "1433835499918983218"; 

// 3. مسار إنشاء التذكرة (أقصى سرعة ومعالجة البيانات)
app.post('/api/create-ticket', async (req, res) => {
    // معالجة المسميات المختلفة التي قد يرسلها المتجر لضمان عدم ظهور "غير محدد"
    const data = req.body;
    const discordId = data.discordId || data.userId;
    const totalPrice = data.totalPrice || data.price || '0';
    const productName = data.productName || data.item || 'منتج غير معروف';
    const categoryName = data.categoryName || data.category || 'عام';
    const quantity = data.quantity || 1;

    if (!discordId) return res.status(400).json({ success: false, error: 'Missing Discord ID' });

    try {
        // تنفيذ العمليات بالتوازي لتقليل وقت الاستجابة
        const [guild, orderId] = await Promise.all([
            client.guilds.cache.get(GUILD_ID) || client.guilds.fetch(GUILD_ID),
            Counter.findOneAndUpdate({ id: "orderId" }, { $inc: { seq: 1 } }, { new: true, upsert: true }).then(d => d.seq)
        ]);

        const member = await guild.members.fetch(discordId.trim()).catch(() => null);
        if (!member) return res.status(404).json({ success: false, error: 'User not in server' });

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
            .setDescription(`أهلاً بك <@${member.id}>\nتم فتح تذكرة لمتابعة طلبك.\n\n**القسم:** ${categoryName}`)
            .addFields(
                { name: 'رقم الطلب', value: `#${orderId}`, inline: true },
                { name: 'المنتج المطلوب', value: `${productName} (x${quantity})`, inline: true },
                { name: 'الإجمالي', value: `${totalPrice}`, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: 'Al-Amariyah RP System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('close_ticket').setLabel('إغلاق التذكرة').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ 
            content: `<@&${ADMIN_ROLE_ID}> | <@${member.id}>`, 
            embeds: [embed], 
            components: [row] 
        });

        res.status(200).json({ success: true, channelId: channel.id });

    } catch (error) {
        console.error('❌ Error creating ticket:', error.message);
        res.status(500).json({ success: false });
    }
});

// 4. نظام إغلاق التذكرة (إصلاح خطأ Unknown interaction)
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton() || interaction.customId !== 'close_ticket') return;

    try {
        // استخدام deferReply لضمان عدم انتهاء وقت التفاعل (يحل مشكلة الصور المرفقة)
        await interaction.deferReply({ ephemeral: true });

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

        await interaction.editReply({ content: '🔒 تم إرسال اللوق، سيتم حذف القناة الآن...' });
        
        // حذف القناة فوراً بعد إرسال اللوق
        await interaction.channel.delete().catch(() => {});

    } catch (err) {
        console.error('Interaction Error:', err.message);
    }
});

client.once('ready', () => console.log(`Logged in as ${client.user.tag} ✅`));
client.login(process.env.TOKEN);

const port = process.env.PORT || 10000;
app.listen(port, '0.0.0.0', () => console.log(`🚀 Server listening on port ${port}`));
