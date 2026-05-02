"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterventionsModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const intervention_service_1 = require("./intervention.service");
const intervention_controller_1 = require("./intervention.controller");
const intervention_entity_1 = require("./intervention.entity");
let InterventionsModule = class InterventionsModule {
};
exports.InterventionsModule = InterventionsModule;
exports.InterventionsModule = InterventionsModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([intervention_entity_1.Intervention])],
        providers: [intervention_service_1.InterventionsService],
        controllers: [intervention_controller_1.InterventionsController],
        exports: [intervention_service_1.InterventionsService],
    })
], InterventionsModule);
//# sourceMappingURL=intervention.module.js.map