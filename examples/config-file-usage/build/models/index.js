"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("mongoose"));
const mongoose_2 = __importDefault(require("../options/mongoose"));
const User_1 = __importDefault(require("./User"));
const getModels = async () => {
    // In case you using mongoose 6
    // https://mongoosejs.com/docs/guide.html#strictQuery
    mongoose_1.default.set('strictQuery', false);
    // Ensure connection is open so we can run migrations
    await mongoose_1.default.connect(process.env.MIGRATE_MONGO_URI ?? 'mongodb://localhost/my-db', mongoose_2.default);
    // Return models that will be used in migration methods
    return {
        mongoose: mongoose_1.default,
        User: User_1.default,
    };
};
exports.default = getModels;
//# sourceMappingURL=index.js.map