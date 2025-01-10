"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const UserSchema = new mongoose_1.Schema({
    firstName: {
        type: String,
        required: true,
    },
    lastName: {
        type: String,
    },
});
exports.default = mongoose_1.models.User ?? (0, mongoose_1.model)('User', UserSchema);
//# sourceMappingURL=User.js.map