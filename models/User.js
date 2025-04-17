const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // Основная информация
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    gender: { type: String, enum: ["male", "female"], required: true },
    birthDay: { type: Date },

    // Геолокация
    country: { type: String },
    city: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },

    // Профиль
    aboutMe: { type: String },
    photos: {
        type: [String],
        default: Array(9).fill(null),
        validate: {
            validator: function(array) {
                return array.length === 9;
            },
            message: 'Массив фотографий должен содержать ровно 9 элементов'
        }
    },
    verified: { type: Boolean, default: false },

    // Настройки
    whoSeesMyProfile: { type: String, enum: ["GIRL", "MAN", "ALL"] },
    language: { type: String, enum: ["EN", "PL"] },
    lookingFor: { type: String, enum: ["GIRL", "MAN"] },
    showOnlyWithPhoto: { type: Boolean, default: false },

    // Безопасность
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    // Финансы
    balance: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// Хэширование пароля перед сохранением
userSchema.pre("save", async function (next) {
  // Всегда хешируем пароль при сохранении
  if (this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Метод для сравнения паролей
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
