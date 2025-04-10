const { google } = require('googleapis');
const OAuth2 = google.auth.OAuth2;

// Хранилище кодов подтверждения
const confirmationCodes = new Map();

// Генерация кода подтверждения
const generateConfirmationCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
};

// Создание Gmail сервиса
const getGmailService = async () => {
    const oauth2Client = new OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI
    );

    try {
        oauth2Client.setCredentials({
            refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });

        // Пробуем получить access token для проверки refresh token
        await oauth2Client.getAccessToken();
        
        return google.gmail({ version: 'v1', auth: oauth2Client });
    } catch (error) {
        if (error.message.includes('invalid_grant')) {
            throw new Error('Refresh token недействителен. Пожалуйста, выполните авторизацию заново через /api/auth/google');
        }
        throw error;
    }
};

// Отправка email
exports.sendEmail = async (req, res) => {
    try {
        const { to, subject, body } = req.body;

        if (!to || !subject || !body) {
            return res.status(400).json({ message: 'Не все поля заполнены' });
        }

        const gmail = await getGmailService();
        let message = '';
        let confirmationCode = '';

        if (subject === 'Confirm') {
            confirmationCode = generateConfirmationCode();
            message = `From: ${process.env.MAIL_USER}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body} ${confirmationCode}`;

            // Сохраняем код
            confirmationCodes.set(to, confirmationCode);

            // Удаляем код через 10 минут
            setTimeout(() => {
                confirmationCodes.delete(to);
            }, 10 * 60 * 1000);
        } else {
            message = `From: ${process.env.MAIL_USER}\r\nTo: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`;
        }

        const encodedMessage = Buffer.from(message)
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');

        await gmail.users.messages.send({
            userId: 'me',
            requestBody: {
                raw: encodedMessage
            }
        });

        res.status(200).json({ 
            message: 'Письмо успешно отправлено',
            confirmationCode: subject === 'Confirm' ? confirmationCode : undefined
        });
    } catch (error) {
        console.error('Ошибка отправки письма:', error);
        if (error.message.includes('Refresh token недействителен')) {
            return res.status(401).json({ 
                message: error.message,
                needReauthorization: true
            });
        }
        res.status(500).json({ message: 'Ошибка отправки письма' });
    }
};

// Подтверждение email
exports.confirmEmail = async (req, res) => {
    try {
        const { code } = req.body;
        const email = req.headers['x-user-email'];

        if (!email) {
            return res.status(400).json({ message: 'Email пользователя не предоставлен' });
        }

        if (!code) {
            return res.status(400).json({ message: 'Код подтверждения не предоставлен' });
        }

        const savedCode = confirmationCodes.get(email);

        if (!savedCode) {
            return res.status(400).json({ message: 'Код подтверждения не найден или истек' });
        }

        if (savedCode !== code) {
            return res.status(400).json({ message: 'Неверный код подтверждения' });
        }

        // Удаляем код после успешной проверки
        confirmationCodes.delete(email);

        res.status(200).json({ message: 'Email успешно подтвержден' });
    } catch (error) {
        console.error('Ошибка подтверждения email:', error);
        res.status(500).json({ message: 'Ошибка подтверждения email' });
    }
}; 