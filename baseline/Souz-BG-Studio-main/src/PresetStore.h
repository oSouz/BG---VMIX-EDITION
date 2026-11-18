#pragma once
// Saved backgrounds ("Salvos" tab): named full scenes kept in one text file shared by
// every plugin instance and every device using the panel. Only the HTTP worker thread
// touches this; never the GL/render thread.
#include "PanelSchema.h"
#include <array>
#include <cmath>
#include <cstdint>
#include <cstdlib>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <locale>
#include <mutex>
#include <sstream>
#include <string>
#include <system_error>
#include <vector>

namespace souz {
struct Preset {
    unsigned id = 0;
    std::string name;
    std::array<float, ParamCount> values{};
};

inline constexpr size_t MaxPresets = 100;
inline constexpr size_t MaxPresetNameBytes = 120;

// Name: 1..120 bytes of valid UTF-8, no control characters, no leading/trailing spaces.
inline bool ValidPresetName(const std::string& s) {
    if (s.empty() || s.size() > MaxPresetNameBytes || s.front() == ' ' || s.back() == ' ') return false;
    for (size_t i = 0; i < s.size();) {
        const unsigned char c = static_cast<unsigned char>(s[i]);
        size_t n = c < 0x80 ? 1 : (c >> 5) == 6 ? 2 : (c >> 4) == 14 ? 3 : (c >> 3) == 30 ? 4 : 0;
        if (!n || i + n > s.size() || c < 0x20 || c == 0x7f || (n == 2 && c < 0xc2) || (n == 4 && c > 0xf4)) return false;
        uint32_t cp = n == 1 ? c : c & (0x7f >> n);
        for (size_t k = 1; k < n; ++k) {
            const unsigned char x = static_cast<unsigned char>(s[i + k]);
            if ((x & 0xc0) != 0x80) return false;
            cp = (cp << 6) | (x & 0x3f);
        }
        if ((n == 3 && (cp < 0x800 || (cp >= 0xd800 && cp <= 0xdfff))) || (n == 4 && (cp < 0x10000 || cp > 0x10ffff))) return false;
        i += n;
    }
    return true;
}

inline bool ValidPresetValue(size_t i, float v) noexcept {
    return i < ParamCount && std::isfinite(v) && v >= 0 && v <= ParamDefs[i].maximum &&
        (!ParamDefs[i].discrete || std::floor(v) == v);
}

inline std::string JsonString(const std::string& s) {
    std::string out = "\"";
    for (char c : s) { if (c == '"' || c == '\\') out += '\\'; out += c; }
    return out + "\"";
}

class PresetStore {
public:
    // SOUZ_PRESETS_FILE overrides the location (tests). Otherwise %APPDATA%\Souz\BG-Studio
    // on Windows and ~/.souz-bg-studio elsewhere. Empty path: saving is unavailable.
    static std::filesystem::path DefaultPath() {
#ifdef _WIN32
        if (const wchar_t* f = _wgetenv(L"SOUZ_PRESETS_FILE"); f && *f) return f;
        if (const wchar_t* a = _wgetenv(L"APPDATA"); a && *a)
            return std::filesystem::path(a) / L"Souz" / L"BG-Studio" / L"backgrounds.txt";
#else
        if (const char* f = std::getenv("SOUZ_PRESETS_FILE"); f && *f) return f;
        if (const char* h = std::getenv("HOME"); h && *h)
            return std::filesystem::path(h) / ".souz-bg-studio" / "backgrounds.txt";
#endif
        return {};
    }

    enum class Result { Ok, Invalid, Full, NotFound, StorageError };

    explicit PresetStore(std::filesystem::path file = DefaultPath()) : path(std::move(file)) {}

    // Every operation re-reads the file under one process-wide lock, so two plugin
    // instances (two workers) never overwrite each other's additions.
    Result List(std::vector<Preset>& out) const {
        std::lock_guard<std::mutex> lock(Mutex());
        return Load(out) ? Result::Ok : Result::StorageError;
    }
    // Same name replaces the stored scene (keeps its id and position).
    Result Save(const std::string& name, const std::array<float, ParamCount>& values, std::vector<Preset>& out) {
        if (!ValidPresetName(name)) return Result::Invalid;
        for (size_t i = 0; i < ParamCount; ++i) if (!ValidPresetValue(i, values[i])) return Result::Invalid;
        std::lock_guard<std::mutex> lock(Mutex());
        if (!Load(out)) return Result::StorageError;
        Preset* existing = nullptr;
        unsigned next = 1;
        for (auto& p : out) { if (p.name == name) existing = &p; if (p.id >= next) next = p.id + 1; }
        if (existing) existing->values = values;
        else {
            if (out.size() >= MaxPresets) return Result::Full;
            out.push_back(Preset{next, name, values});
        }
        return Write(out) ? Result::Ok : Result::StorageError;
    }
    Result Remove(unsigned id, std::vector<Preset>& out) {
        std::lock_guard<std::mutex> lock(Mutex());
        if (!Load(out)) return Result::StorageError;
        const auto before = out.size();
        for (auto it = out.begin(); it != out.end();) it = it->id == id ? out.erase(it) : it + 1;
        if (out.size() == before) return Result::NotFound;
        return Write(out) ? Result::Ok : Result::StorageError;
    }

    static std::string ToJson(const std::vector<Preset>& list) {
        std::ostringstream body; body.imbue(std::locale::classic());
        body << std::setprecision(7) << "{\"max\":" << MaxPresets << ",\"presets\":[";
        for (size_t p = 0; p < list.size(); ++p) {
            if (p) body << ",";
            body << "{\"id\":" << list[p].id << ",\"name\":" << JsonString(list[p].name) << ",\"values\":{";
            for (size_t i = 0; i < ParamCount; ++i) body << (i ? "," : "") << "\"" << ParamDefs[i].name << "\":" << list[p].values[i];
            body << "}}";
        }
        body << "]}";
        return body.str();
    }

private:
    std::filesystem::path path;
    static std::mutex& Mutex() { static std::mutex m; return m; }

    // Missing file = empty list. Unknown parameters are ignored and missing or invalid
    // ones fall back to the default, so files from other versions keep loading.
    bool Load(std::vector<Preset>& out) const {
        out.clear();
        if (path.empty()) return false;
        std::error_code ec;
        if (!std::filesystem::exists(path, ec)) return !ec;
        std::ifstream in(path, std::ios::binary);
        if (!in) return false;
        std::string line;
        Preset* current = nullptr;
        while (std::getline(in, line)) {
            if (!line.empty() && line.back() == '\r') line.pop_back();
            if (line.rfind("Preset ", 0) == 0) {
                if (out.size() >= MaxPresets) break;
                Preset p;
                for (size_t i = 0; i < ParamCount; ++i) p.values[i] = ParamDefs[i].defaultValue;
                try { p.id = static_cast<unsigned>(std::stoul(line.substr(7))); } catch (...) { current = nullptr; continue; }
                out.push_back(p); current = &out.back();
            } else if (current && line.rfind("Name ", 0) == 0) {
                current->name = line.substr(5);
            } else if (current && line != "End") {
                std::istringstream pair(line); pair.imbue(std::locale::classic());
                std::string key; float v;
                if (!(pair >> key >> v)) continue;
                for (size_t i = 0; i < ParamCount; ++i)
                    if (key == ParamDefs[i].name && ValidPresetValue(i, v)) current->values[i] = v;
            }
        }
        // Drop damaged entries (bad name or duplicate id/name) instead of failing the list.
        std::vector<Preset> clean;
        for (auto& p : out) {
            bool duplicate = false;
            for (auto& q : clean) duplicate = duplicate || q.id == p.id || q.name == p.name;
            if (p.id && ValidPresetName(p.name) && !duplicate) clean.push_back(std::move(p));
        }
        out = std::move(clean);
        return true;
    }

    // Write a temporary file, then replace: a crash never leaves a half-written list.
    bool Write(const std::vector<Preset>& list) const {
        std::error_code ec;
        if (path.has_parent_path()) std::filesystem::create_directories(path.parent_path(), ec);
        if (ec) return false;
        auto temp = path; temp += ".tmp";
        {
            std::ofstream outFile(temp, std::ios::binary | std::ios::trunc);
            if (!outFile) return false;
            outFile.imbue(std::locale::classic());
            outFile << std::setprecision(9) << "SOUZ-BG-STUDIO-BACKGROUNDS 1\n";
            for (const auto& p : list) {
                outFile << "Preset " << p.id << "\nName " << p.name << "\n";
                for (size_t i = 0; i < ParamCount; ++i) outFile << ParamDefs[i].name << " " << p.values[i] << "\n";
                outFile << "End\n";
            }
            outFile.flush();
            if (!outFile) { outFile.close(); std::filesystem::remove(temp, ec); return false; }
        }
        std::filesystem::rename(temp, path, ec);
        if (ec) { std::error_code ignore; std::filesystem::remove(temp, ignore); return false; }
        return true;
    }
};
}
