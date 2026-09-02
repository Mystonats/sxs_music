#!/usr/bin/env python3
"""Build tracks.js from the original 32-track catalog plus the expanded library."""
from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OLD = json.loads((ROOT / "tracks.json").read_text(encoding="utf-8"))
TW = json.loads((ROOT / "tw-tracks.json").read_text(encoding="utf-8"))

KINGDOM_ORDER = [
    "Verdantglade",
    "Cinder Ridge",
    "Aqualis",
    "Loong Haven",
    "Aethyris",
    "Acme Nexus",
    "Whaleback",
    "Originisle",
    "Cosmic Voyage",
    "Whimsy World",
]

EN_BY_ZH = {
    "双旦奇境": "Twin Holidays",
    "千霄之迹": "Traces Across the Sky",
    "达拉崩吧": "Da La Beng Ba",
    "杖之歌": "Song of the Staff",
    "剑之歌": "Song of the Sword",
    "权御天下": "The Emperor's Arrival",
    "冠世一战": "Battle of a Generation",
    "反乌托邦2": "Dystopia 2",
    "大君岛": "Daikun Island",
    "音乐大厅(音浪)": "Concert Hall — Soundwave",
    "音乐大厅(洛天依)": "Concert Hall — Luo Tianyi",
    "音浪音乐节": "Soundwave Music Festival",
    "解谜活动地图场景音乐": "Puzzle Event",
}

PACK_LABELS = {
    "Activity_001_MoonFestival": "Moon Festival",
    "Activity_002_Halloween": "Halloween",
    "Activity_003_LuoXiaoHei": "Luo Xiaohei",
    "Activity_004_Pirate": "Pirate",
    "Activity_005_SpecialForce": "Special Force",
    "Activity_006_JourneyCelebration": "Journey Celebration",
    "Activity_007_Christmas": "Christmas",
    "Activity_008_FantacyJoker": "Fantasy Joker",
    "Activity_009_HotPot": "Hot Pot",
    "Activity_010_WindElf": "Wind Elf",
    "Activity_011_NewYear": "New Year",
    "Activity_012_WuLiuQi": "Wu Liuqi",
    "Activity_013_LuoTianyi": "Luo Tianyi",
    "Activity_014_BlackCat": "Black Cat",
    "Activity_015_SpringOuting": "Spring Outing",
    "Activity_016_WesternCowboy": "Western Cowboy",
    "Activity_017_MayDay2026": "May Day",
    "Activity_018_LuckyBag": "Lucky Bag",
    "Activity_019_GourmetJourney": "Gourmet Journey",
    "Activity_020_1stAnniversary": "1st Anniversary",
    "Activity_021_WorldCup": "World Cup",
    "Activity_022_DragonBoat": "Dragon Boat",
    "Activity_023_Slime": "Slime",
    "Activity_024_LuoTianYi_en": "Luo Tianyi",
    "Activity_025_LuoTianYi_2_cn": "Luo Tianyi",
    "Activity_026_1stAnniversary_jp": "1st Anniversary",
    "Activity_027_ChineseOdyssey": "Chinese Odyssey",
    "Activity_028_Bocchi_jp": "Bocchi",
    "Battle_BGM_00": "Set I",
    "Battle_BGM_01": "Set II",
    "Battle_BGM_02": "Set III",
    "Battle_BGM_03": "Set IV",
    "Battle_BGM_04": "Set V",
    "Battle_BGM_05": "Set VI",
    "Battle_BGM_06": "Set VII",
    "Battle_BGM_Public": "Shared",
    "Fashion_01_RadioWaves": "Radio Waves",
    "Fashion_02_MagicLamp": "Magic Lamp",
    "Home_BGM_01": "Home",
    "Map_BGM_00": "Kingdoms",
    "Map_BGM_01": "Kingdoms",
    "Map_BGM_02": "Kingdoms",
    "Map_BGM_Public": "Kingdoms",
    "System_001_BattleRoyale": "Battle Royale",
    "UI_BGM_01": "Menus I",
    "UI_BGM_02": "Menus II",
    "Version_004_Season_04_BGM": "Season 4",
    "Version_005_Season_05_BGM": "Season 5",
}


def language_from(text: str) -> str | None:
    if re.search(r"日语", text):
        return "JP"
    if re.search(r"英语", text):
        return "EN"
    if re.search(r"国语", text) or re.search(r"国服", text):
        return "CN"
    if re.search(r"日服主题曲", text):
        return "JP"
    if re.search(r"权御天下|冠世一战|反乌托邦", text):
        return "CN"
    if re.search(r"达拉崩吧", text):
        return "CN"
    return None


def server_from(text: str) -> str | None:
    if "欧美" in text:
        return "EN"
    if "日本" in text:
        return "JP"
    if "港澳台" in text:
        return "TW"
    if "大陆" in text:
        return "CN"
    return None


def region_from(text: str) -> str | None:
    language = language_from(text)
    if language:
        return language
    if re.search(r"音浪|音乐大厅", text):
        return server_from(text)
    return None


def song_from(text: str) -> str | None:
    inner = re.search(r"[（(]([^）)]+)[）)]", text)
    if inner and re.search(r"杖之歌|剑之歌", inner.group(1)):
        return inner.group(1).split("·")[0].split("・")[0].strip()
    for name in ["达拉崩吧", "权御天下", "冠世一战", "杖之歌", "剑之歌", "反乌托邦2"]:
        if name in text:
            return name
    return None


def hall_name(text: str) -> str | None:
    if "音乐大厅" in text and "音浪" in text:
        return "音乐大厅(音浪)"
    if "音乐大厅" in text and "洛天依" in text:
        return "音乐大厅(洛天依)"
    if "音浪音乐节" in text:
        return "音浪音乐节"
    return None


def classify_named(title: str, memo: str, map_name: str | None, bgm_id) -> str | None:
    if bgm_id == 99 or title == "测试岛":
        return None
    blob = f"{title} {memo}"
    if map_name or bgm_id == 91 or title in KINGDOM_ORDER:
        return "kingdoms"
    if re.search(r"洛天依|达拉崩吧|杖之歌|剑之歌|权御天下|冠世一战|反乌托邦", blob):
        return "concert"
    if "音浪" in blob:
        return "festival"
    return "seasonal"


def present_named(title: str, memo: str, map_name: str | None, bgm_id, extra_badges=None):
    blob = f"{title or ''} {memo or ''}"
    song = song_from(blob)
    hall = hall_name(blob)
    zh_core = song or hall or re.sub(r"\s{2,}", " ", re.sub(
        r"\s*-\s*(日本|欧美|港澳台|大陆)\s*", "",
        re.sub(r"\s*-\s*公测版", "", memo or title or ""),
    )).strip()
    badges = []
    region = region_from(blob)
    if region:
        badges.append({"text": region, "kind": "region"})
    if extra_badges:
        badges.extend(extra_badges)
    if "伴奏" in blob:
        badges.append({"text": "Instrumental", "kind": ""})
    if map_name == "Whimsy World":
        badges.append({"text": "Unreleased", "kind": "unreleased"})
        badges.append({"text": "Harpadia", "kind": ""})
    if map_name:
        name, zh = map_name, memo or ""
    elif bgm_id == 91 or zh_core == "大君岛":
        name, zh = "Daikun Island", "大君岛"
    else:
        name = EN_BY_ZH.get(zh_core) or EN_BY_ZH.get(song or "") or title
        zh = song or hall or zh_core
    section = classify_named(title or "", memo or "", map_name, bgm_id)
    sort = KINGDOM_ORDER.index(map_name) if map_name in KINGDOM_ORDER else 100
    if bgm_id == 91:
        sort = 100
    return name, zh, section, badges, sort


def pack_section(pack: str) -> str | None:
    if pack.startswith("Voice_"):
        return None
    if pack.startswith("Battle_") or pack.startswith("System_"):
        return "battle"
    if pack.startswith("Activity_"):
        return "events"
    if pack.startswith("Fashion_"):
        return "fashion"
    if pack.startswith("Home_"):
        return "home"
    if pack.startswith("Version_"):
        return "seasons"
    if pack.startswith("UI_"):
        return "interface"
    if pack.startswith("Map_"):
        return "kingdoms"
    return "events"


def pretty_pack(pack: str) -> str:
    return PACK_LABELS.get(pack, pack.replace("_", " "))


def rec(name, zh, path, section, group, badges, sort):
    return {
        "name": name,
        "zh": zh if zh and zh != name else "",
        "path": path,
        "section": section,
        "group": group or "",
        "badges": badges,
        "sort": sort,
    }


def main() -> None:
    out = []
    old_wem = {t["wemId"] for t in OLD}
    old_titles = {t.get("title") for t in OLD if t.get("title")} | set(KINGDOM_ORDER)

    untitled_total = defaultdict(int)
    for t in TW:
        if t.get("title") or t["pack"].startswith("Voice_"):
            continue
        untitled_total[t["pack"]] += 1

    for t in OLD:
        name, zh, section, badges, sort = present_named(
            t.get("title") or "", t.get("memoZh") or "", t.get("map"), t.get("bgmId")
        )
        if not section:
            continue
        out.append(rec(name, zh, f"audio/{t['file']}.ogg", section, "", badges, sort))

    untitled_index = defaultdict(int)
    for t in TW:
        pack = t["pack"]
        title = t.get("title")
        wem = t["wemId"]
        path = f"audio/tw/{t['file']}.ogg"
        if pack.startswith("Voice_"):
            continue
        if title:
            if wem in old_wem or title in old_titles or title == "测试岛":
                continue
            name, zh, section, badges, sort = present_named(
                title, title, title if title in KINGDOM_ORDER else None, None
            )
            if not section:
                section = pack_section(pack)
            group = pretty_pack(pack) if section == "events" else ""
            out.append(rec(name, zh, path, section, group, badges, sort))
            continue

        section = pack_section(pack)
        if not section:
            continue
        untitled_index[pack] += 1
        n = untitled_index[pack]
        label = pretty_pack(pack)
        total = untitled_total[pack]
        group = label
        if pack.startswith("Battle_BGM_"):
            name, zh, group = f"Theme {n}", "", label
        elif pack.startswith("System_"):
            name, zh, group = label, "", ""
        elif section in ("seasons", "interface", "events"):
            name, zh = (label, "") if total == 1 else (f"Theme {n}", "")
            if total == 1:
                group = ""
        elif section in ("fashion", "home"):
            name, zh, group = label, "", ""
        else:
            name, zh = (label, "") if total == 1 else (f"{label} {n}", "")
        out.append(rec(name, zh, path, section, group, [], n))

    (ROOT / "tracks.js").write_text(
        "window.TRACKS = " + json.dumps(out, ensure_ascii=False, indent=1) + ";\n",
        encoding="utf-8",
    )
    by = defaultdict(int)
    for t in out:
        by[t["section"]] += 1
    print("tracks", len(out), dict(by))


if __name__ == "__main__":
    main()
