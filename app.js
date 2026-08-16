(function () {
    "use strict";

    var API_BASE = "https://bqccsgglwvhkbzsqyywd.supabase.co/functions/v1/";
    var CURRENT_APP_VERSION = "1.3.0";
    var LIMIT = 100;
    var AUTO_REFRESH_MS = 60000;
    var state = {
        mode: "highscore",
        period: "all_time",
        device: "all",
        version: "all",
        leaderboardCode: "",
        entries: [],
        requestId: 0
    };
    var modeConfig = {
        highscore: { label: "Highscore", endpoint: "leaderboard", metric: "balance", heading: "Balance" },
        prestige: { label: "Prestige", endpoint: "leaderboard", metric: "prestige", heading: "Prestige" },
        hardcore: { label: "Hardcore", endpoint: "hardcore-leaderboard", heading: "Hardcore Balance" },
        survival: { label: "Survival", endpoint: "survival-leaderboard", heading: "Time" },
        pvp: { label: "PVP", endpoint: "pvp-leaderboard", heading: "Matches" }
    };
    var brokerLogos = {
        LCG: "assets/lcg-logo.png",
        EQUITI: "assets/equiti-logo.png",
        IG: "assets/ig-logo.png",
        NONE: "assets/New_Icon.png",
        MRT: "assets/New_Icon.png"
    };
    var brokerNames = {
        LCG: "London Capital Group",
        EQUITI: "Equiti",
        IG: "IG",
        NONE: "Market Runner Trading",
        MRT: "Market Runner Trading"
    };
    var periodLabels = {
        all_time: "All Time",
        this_month: "This Month",
        today: "Today"
    };
    var deviceLabels = {
        all: "All Devices",
        pc: "PC",
        mobile: "Mobile"
    };

    var elements = {
        body: document.getElementById("leaderboard-body"),
        button: document.getElementById("refresh-button"),
        filterDetails: document.querySelector(".filter-details"),
        status: document.getElementById("status-pill"),
        tableTitle: document.getElementById("table-title"),
        tableHead: document.getElementById("leaderboard-head"),
        filterSummary: document.getElementById("filter-summary-label"),
        codeInput: document.getElementById("board-code"),
        codeField: document.querySelector(".code-field"),
        pvpStats: document.getElementById("pvp-stats"),
        profilePanel: document.getElementById("profile-panel"),
        profileTitle: document.getElementById("profile-title"),
        profileBody: document.getElementById("profile-body"),
        profileClose: document.getElementById("profile-close")
    };

    function initializeFilterPanel() {
        if (elements.filterDetails) {
            elements.filterDetails.open = window.matchMedia("(min-width: 621px)").matches;
        }
    }

    function readControls() {
        state.mode = checkedValue("leaderboard", state.mode);
        state.period = checkedValue("period", state.period);
        state.device = checkedValue("device", state.device);
        state.version = checkedValue("version", state.version);
        state.leaderboardCode = isStandardMode() ? cleanInviteCode(elements.codeInput.value) : "";
        syncCodeField();
    }

    function checkedValue(name, fallback) {
        var input = document.querySelector("input[name=\"" + name + "\"]:checked");
        return input ? input.value : fallback;
    }

    function isStandardMode() {
        return state.mode === "highscore" || state.mode === "prestige";
    }

    function syncCodeField() {
        var enabled = isStandardMode();
        elements.codeInput.disabled = !enabled;
        elements.codeField.classList.toggle("is-disabled", !enabled);
        elements.codeField.querySelector("span").textContent = enabled
            ? "Private Board Code"
            : "Private Board Code (Highscore / Prestige)";
    }

    function setStatus(text, isError) {
        elements.status.textContent = text;
        elements.status.classList.toggle("is-error", Boolean(isError));
    }

    function requestUrl() {
        var config = modeConfig[state.mode];
        var url = new URL(config.endpoint, API_BASE);
        url.searchParams.set("limit", String(LIMIT));
        url.searchParams.set("period", state.period);
        url.searchParams.set("device", state.device);
        url.searchParams.set("version", state.version);
        url.searchParams.set("app_version", CURRENT_APP_VERSION);
        if (isStandardMode()) {
            url.searchParams.set("metric", config.metric);
            if (state.leaderboardCode) {
                url.searchParams.set("code", state.leaderboardCode);
            }
        }
        return url.toString();
    }

    function fetchWithTimeout(url, timeoutMs) {
        var controller = new AbortController();
        var timeout = window.setTimeout(function () {
            controller.abort();
        }, timeoutMs);

        return fetch(url, {
            headers: { Accept: "application/json" },
            signal: controller.signal
        }).finally(function () {
            window.clearTimeout(timeout);
        });
    }

    async function refreshLeaderboard() {
        readControls();
        var requestId = ++state.requestId;
        var config = modeConfig[state.mode];
        elements.button.disabled = true;
        setStatus("Loading", false);
        updateHeading();

        try {
            var response = await fetchWithTimeout(requestUrl(), 9000);
            var payload = await response.json();
            if (requestId !== state.requestId) {
                return;
            }
            if (!response.ok) {
                throw new Error(payload.error || "Leaderboard request failed with HTTP " + response.status + ".");
            }
            if (!payload.ok) {
                throw new Error(payload.error || "Leaderboard response was not successful.");
            }
            if (payload.access_denied) {
                throw new Error("Private leaderboard access denied.");
            }
            if (state.leaderboardCode && !payload.private_leaderboard) {
                throw new Error("Private board code was not accepted by the live backend.");
            }

            renderEntries(Array.isArray(payload.entries) ? payload.entries : [], payload.private_leaderboard);
            renderPvpStats(payload.computer_stats);
            setStatus(deviceLabels[state.device] + " | Auto 60s", false);
        } catch (error) {
            if (requestId !== state.requestId) {
                return;
            }
            renderError(error.message || "Leaderboard request failed.");
            renderPvpStats(null);
            setStatus(config.label + " unavailable", true);
        } finally {
            if (requestId === state.requestId) {
                elements.button.disabled = false;
            }
        }
    }

    function updateHeading() {
        var config = modeConfig[state.mode];
        var boardLabel = state.leaderboardCode && isStandardMode() ? "Private" : "Global";
        elements.tableTitle.textContent = boardLabel + " " + config.label + " Top " + LIMIT + " - " + periodLabels[state.period];
        elements.filterSummary.textContent = config.label + ", " + periodLabels[state.period] + ", " + deviceLabels[state.device];
        elements.tableHead.innerHTML = tableHeadMarkup();
    }

    function tableHeadMarkup() {
        var config = modeConfig[state.mode];
        if (state.mode === "survival") {
            return "<tr><th>Rank</th><th>Runner</th><th>Time</th><th>Broker</th><th>Platform</th></tr>";
        }
        if (state.mode === "pvp") {
            return "<tr><th>Rank</th><th>Runner</th><th>Matches</th><th>Ratio</th><th>W-L-T</th><th>Platform</th></tr>";
        }
        return "<tr><th>Rank</th><th>Runner</th><th>" + config.heading + "</th><th>Level</th><th>Broker</th><th>Platform</th></tr>";
    }

    function renderEntries(entries, privateBoard) {
        state.entries = entries;
        updateHeading();
        if (!entries.length) {
            var emptyMessage = state.mode === "survival"
                ? "No survival times found."
                : state.mode === "pvp"
                    ? "No PVP matches found."
                    : "No leaderboard entries found.";
            elements.body.innerHTML = emptyRowMarkup(emptyMessage);
            return;
        }

        elements.tableTitle.textContent = (privateBoard && privateBoard.name ? String(privateBoard.name) : "Global")
            + " " + modeConfig[state.mode].label + " Top " + LIMIT + " - " + periodLabels[state.period];
        elements.body.innerHTML = entries.map(function (entry, index) {
            return rowMarkup(entry, index);
        }).join("");
    }

    function rowMarkup(entry, index) {
        var podium = podiumClass(index);
        var classes = ["profile-row"];
        if (podium) {
            classes.push(podium);
        }
        var name = escapeHtml(String(entry.display_name || "Player"));
        var row = [
            "<tr class=\"" + classes.join(" ") + "\" data-entry-index=\"" + index + "\" tabindex=\"0\" role=\"button\" aria-label=\"Open public profile for " + name + "\">",
            "<td class=\"rank\">#" + (index + 1) + "</td>",
            "<td><span class=\"runner-name\">" + name + "</span><span class=\"profile-hint\">View profile</span></td>"
        ];
        if (state.mode === "survival") {
            row.push("<td class=\"metric-value\">" + formatSurvivalTime(entry.survival_seconds) + "</td>");
            row.push(brokerCell(entry));
            row.push("<td>" + escapeHtml(displayPlatform(entry.platform)) + "</td>");
        } else if (state.mode === "pvp") {
            row.push("<td class=\"metric-value\">" + formatInteger(entry.pvp_matches_played) + "</td>");
            row.push("<td class=\"metric-value\">" + formatPvpRatio(entry) + "</td>");
            row.push("<td>" + formatInteger(entry.pvp_wins) + "-" + formatInteger(entry.pvp_losses) + "-" + formatInteger(entry.pvp_ties) + "</td>");
            row.push("<td>" + escapeHtml(displayPlatform(entry.platform)) + "</td>");
        } else {
            var value = state.mode === "prestige"
                ? formatInteger(entry.prestige_count)
                : state.mode === "hardcore"
                    ? formatMoney(entry.hardcore_balance)
                    : formatMoney(entry.score);
            var level = state.mode === "hardcore" ? entry.hardcore_level : entry.level;
            row.push("<td class=\"metric-value\">" + value + "</td>");
            row.push("<td>" + formatInteger(level) + "</td>");
            row.push(brokerCell(entry));
            row.push("<td>" + escapeHtml(displayPlatform(entry.platform)) + "</td>");
        }
        row.push("</tr>");
        return row.join("");
    }

    function brokerCell(entry) {
        var broker = cleanBrokerKey(entry.broker);
        var rawName = String(entry.broker_display_name || entry.broker_name || broker || "Market Runner Trading");
        return "<td><span class=\"broker-cell\">" + brokerIdentityMarkup(broker, rawName) + "<span>" + escapeHtml(rawName) + "</span></span></td>";
    }

    function renderPvpStats(stats) {
        if (!stats || state.mode !== "pvp") {
            elements.pvpStats.hidden = true;
            elements.pvpStats.innerHTML = "";
            return;
        }
        elements.pvpStats.hidden = false;
        elements.pvpStats.innerHTML = "<strong>Computer opponent</strong> "
            + formatInteger(stats.pvp_matches_played) + " matches · "
            + formatInteger(stats.pvp_wins) + "-" + formatInteger(stats.pvp_losses) + "-" + formatInteger(stats.pvp_ties);
    }

    function podiumClass(index) {
        if (index === 0) {
            return "first-place";
        }
        if (index === 1) {
            return "second-place";
        }
        if (index === 2) {
            return "third-place";
        }
        return "";
    }

    function emptyRowMarkup(message) {
        var columnCount = state.mode === "survival" ? 5 : 6;
        return "<tr class=\"empty-row\"><td colspan=\"" + columnCount + "\">" + escapeHtml(message) + "</td></tr>";
    }

    function renderError(message) {
        elements.body.innerHTML = emptyRowMarkup(message);
    }

    function openProfile(index) {
        var entry = state.entries[index];
        if (!entry) {
            return;
        }
        elements.profileTitle.textContent = String(entry.display_name || "Player");
        elements.profileBody.innerHTML = profileMarkup(entry);
        elements.profilePanel.hidden = false;
        elements.profileClose.focus();
    }

    function closeProfile() {
        elements.profilePanel.hidden = true;
    }

    function profileMarkup(entry) {
        var score = Math.max(Number(entry.public_high_score || 0), Number(entry.score || 0));
        var hardcore = Math.max(Number(entry.hardcore_high_score || 1000), Number(entry.hardcore_balance || 1000));
        var ratio = formatPvpRatio(entry);
        var stats = [
            ["Verified ID", entry.public_id || "MR-000000"],
            ["Highest balance", formatMoney(score)],
            ["Highest level", formatInteger(entry.public_high_score_level || entry.level)],
            ["Prestige", formatInteger(entry.public_prestige_count || entry.prestige_count)],
            ["Hardcore best", formatMoney(hardcore)],
            ["Survival best", formatSurvivalTime(entry.survival_best_seconds)],
            ["PVP matches / ratio", formatInteger(entry.pvp_matches_played) + " / " + ratio],
            ["PVP record", formatInteger(entry.pvp_wins) + "-" + formatInteger(entry.pvp_losses) + "-" + formatInteger(entry.pvp_ties)],
            ["Daily streak", "x" + formatInteger(entry.daily_streak_count)],
            ["Broker", entry.broker_display_name || entry.broker_name || entry.broker || "Market Runner Trading"],
            ["Platform", displayPlatform(entry.platform)],
            ["Player", String(entry.player_body || "MALE").toUpperCase()]
        ];
        return "<dl class=\"profile-stats\">" + stats.map(function (stat) {
            return "<div><dt>" + escapeHtml(stat[0]) + "</dt><dd>" + escapeHtml(String(stat[1])) + "</dd></div>";
        }).join("") + "</dl>";
    }

    function cleanBrokerKey(value) {
        return String(value || "NONE").trim().toUpperCase();
    }

    function cleanInviteCode(value) {
        return String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 64);
    }

    function brokerLogo(broker) {
        return brokerLogos[broker] || brokerLogos.NONE;
    }

    function brokerLogoClass(broker) {
        return broker === "IG" || broker === "LCG" ? "logo-on-dark" : "";
    }

    function brokerIdentityMarkup(broker, displayName) {
        if (usesFallbackBrokerName(broker, displayName)) {
            return "<span class=\"fallback-logo\">" + escapeHtml(brokerInitials(displayName)) + "</span>";
        }
        return "<img src=\"" + brokerLogo(broker) + "\" class=\"" + brokerLogoClass(broker) + "\" alt=\"\">";
    }

    function usesFallbackBrokerName(broker, displayName) {
        var configuredName = brokerNames[broker] || "";
        return configuredName && normalizeName(displayName) !== normalizeName(configuredName);
    }

    function brokerInitials(name) {
        var words = String(name || "").toUpperCase().split(/\s+/).filter(Boolean);
        if (!words.length) {
            return "MR";
        }
        if (words.length === 1) {
            return words[0].slice(0, 3);
        }
        return words.slice(0, 3).map(function (word) { return word[0]; }).join("");
    }

    function normalizeName(name) {
        return String(name || "").trim().toUpperCase().replace(/\s+/g, " ");
    }

    function displayPlatform(value) {
        var platform = String(value || "Unknown").replace(/_/g, " ").trim();
        return platform ? platform.toUpperCase() : "Unknown";
    }

    function formatMoney(value) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
    }

    function formatInteger(value) {
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(Number(value || 0));
    }

    function formatSurvivalTime(value) {
        var seconds = Math.max(0, Math.floor(Number(value || 0)));
        var minutes = Math.floor(seconds / 60);
        return minutes + ":" + String(seconds % 60).padStart(2, "0");
    }

    function formatPvpRatio(entry) {
        var matches = Number(entry.pvp_matches_played || 0);
        var wins = Number(entry.pvp_wins || 0);
        var losses = Number(entry.pvp_losses || 0);
        if (!matches || (!wins && !losses)) {
            return "-";
        }
        var ratio = Number(entry.pvp_win_loss_ratio);
        if (!Number.isFinite(ratio)) {
            ratio = losses === 0 ? wins : wins / Math.max(losses, 1);
        }
        return ratio.toFixed(2);
    }

    function escapeHtml(value) {
        return String(value).replace(/[&<>\"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    initializeFilterPanel();
    syncCodeField();
    elements.profilePanel.hidden = true;
    document.querySelectorAll("input[type=\"radio\"]").forEach(function (input) {
        input.addEventListener("change", refreshLeaderboard);
    });
    elements.button.addEventListener("click", refreshLeaderboard);
    elements.codeInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            refreshLeaderboard();
        }
    });
    elements.body.addEventListener("click", function (event) {
        var row = event.target.closest(".profile-row");
        if (row) {
            openProfile(Number(row.dataset.entryIndex));
        }
    });
    elements.body.addEventListener("keydown", function (event) {
        if ((event.key === "Enter" || event.key === " ") && event.target.closest(".profile-row")) {
            event.preventDefault();
            openProfile(Number(event.target.closest(".profile-row").dataset.entryIndex));
        }
    });
    elements.profileClose.addEventListener("click", closeProfile);
    elements.profilePanel.addEventListener("click", function (event) {
        if (event.target === elements.profilePanel) {
            closeProfile();
        }
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !elements.profilePanel.hidden) {
            closeProfile();
        }
    });
    refreshLeaderboard();
    window.setInterval(refreshLeaderboard, AUTO_REFRESH_MS);
})();
