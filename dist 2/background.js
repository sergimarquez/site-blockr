/// <reference types="chrome"/>
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
// Load initial blocked sites from storage
chrome.storage.local.get(['blockedSites'], function (result) {
    var data = result.blockedSites || { sites: [], isBlockingEnabled: true };
    console.log('Loaded blocked sites:', data);
    updateRules(data.sites, data.isBlockingEnabled);
});
// Listen for changes in blocked sites
chrome.storage.onChanged.addListener(function (changes, namespace) {
    if (namespace === 'local' && changes.blockedSites) {
        var newData = changes.blockedSites.newValue;
        console.log('Updated blocked sites:', newData);
        updateRules(newData.sites, newData.isBlockingEnabled);
    }
});
// Update blocking rules
function updateRules(sites, isEnabled) {
    return __awaiter(this, void 0, void 0, function () {
        var existingRules, ruleIdsToRemove, rules, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 7, , 8]);
                    return [4 /*yield*/, chrome.declarativeNetRequest.getDynamicRules()];
                case 1:
                    existingRules = _a.sent();
                    ruleIdsToRemove = existingRules.map(function (rule) { return rule.id; });
                    if (!(ruleIdsToRemove.length > 0)) return [3 /*break*/, 3];
                    return [4 /*yield*/, chrome.declarativeNetRequest.updateDynamicRules({
                            removeRuleIds: ruleIdsToRemove
                        })];
                case 2:
                    _a.sent();
                    _a.label = 3;
                case 3:
                    if (!(isEnabled && sites.length > 0)) return [3 /*break*/, 5];
                    rules = sites.map(function (site, index) { return ({
                        id: index + 1,
                        priority: 1,
                        action: { type: 'block' },
                        condition: {
                            urlFilter: "*://*".concat(site.url, "/*"),
                            resourceTypes: ['main_frame']
                        }
                    }); });
                    return [4 /*yield*/, chrome.declarativeNetRequest.updateDynamicRules({
                            addRules: rules
                        })];
                case 4:
                    _a.sent();
                    console.log('Added blocking rules for', sites.length, 'sites');
                    return [3 /*break*/, 6];
                case 5:
                    console.log('Blocking disabled or no sites to block');
                    _a.label = 6;
                case 6: return [3 /*break*/, 8];
                case 7:
                    error_1 = _a.sent();
                    console.error('Error updating rules:', error_1);
                    return [3 /*break*/, 8];
                case 8: return [2 /*return*/];
            }
        });
    });
}
