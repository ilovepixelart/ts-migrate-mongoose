"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = __importDefault(require("./options/mongoose"));
exports.default = {
    uri: 'mongodb://localhost/my-db',
    migrationsPath: 'migrations',
    connectOptions: mongoose_1.default,
};
//# sourceMappingURL=migrate.js.map