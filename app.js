(function () {
    "use strict";

    var LEADERBOARD_ENDPOINT = "https://bqccsgglwvhkbzsqyywd.supabase.co/functions/v1/leaderboard";
    var LIMIT = 100;
    var AUTO_REFRESH_MS = 60000;
    var state = {
        period: "all_time",
        device: "all",
        metric: "balance",
        leaderboardCode: ""
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
        metricHeading: document.querySelector(".metric-heading")
    };

    function initializeFilterPanel() {
        if (!elements.filterDetails) {
            return;
        }
        elements.filterDetails.open = window.matchMedia("(min-width: 621px)").matches;
    }

    function readControls() {
        state.period = checkedValue("period", state.period);
        state.device = checkedValue("device", state.device);
        state.metric = checkedValue("metric", state.metric);
        state.leaderboardCode = cleanInviteCode(document.getElementById("board-code").value);
    }

    function checkedValue(name, fallback) {
        var input = document.querySelector("input[name=\"" + name + "\"]:checked");
        return input ? input.value : fallback;
    }

    function setStatus(text, isError) {
        elements.status.textContent = text;
        elements.status.classList.toggle("is-error", Boolean(isError));
    }

    function requestUrl() {
        var url = new URL(LEADERBOARD_ENDPOINT);
        url.searchParams.set("limit", String(LIMIT));
        url.searchParams.set("period", state.period);
        url.searchParams.set("device", state.device);
        url.searchParams.set("metric", state.metric);
        url.searchParams.set("version", "all");
        if (state.leaderboardCode) {
            url.searchParams.set("code", state.leaderboardCode);
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
        elements.button.disabled = true;
        setStatus("Loading", false);
        elements.tableTitle.textContent = "Global Top " + LIMIT + " - " + periodLabels[state.period];
        elements.metricHeading.textContent = state.metric === "prestige" ? "Prestige" : "Balance";

        try {
            var response = await fetchWithTimeout(requestUrl(), 9000);
            var payload = await response.json();
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
                throw new Error("Leaderboard code viewing is not deployed on the live backend yet.");
            }

            renderEntries(Array.isArray(payload.entries) ? payload.entries : [], payload.private_leaderboard);
            setStatus(deviceLabels[state.device] + " | Auto 60s", false);
        } catch (error) {
            renderError(error.message || "Leaderboard request failed.");
            setStatus("Unavailable", true);
        } finally {
            elements.button.disabled = false;
        }
    }

    function renderEntries(entries, privateBoard) {
        var titlePrefix = privateBoard && privateBoard.name ? String(privateBoard.name) : "Global";
        elements.tableTitle.textContent = titlePrefix + " Top " + LIMIT + " - " + periodLabels[state.period];
        if (!entries.length) {
            elements.body.innerHTML = "<tr class=\"empty-row\"><td colspan=\"6\">No leaderboard entries found.</td></tr>";
            return;
        }

        elements.body.innerHTML = entries.map(function (entry, index) {
            var broker = cleanBrokerKey(entry.broker);
            var rawBrokerName = String(entry.broker_display_name || broker || "Market Runner Trading");
            var brokerName = escapeHtml(rawBrokerName);
            var platform = escapeHtml(displayPlatform(entry.platform));
            var score = state.metric === "prestige"
                ? formatInteger(entry.prestige_count)
                : formatMoney(entry.score);
            var rowClass = podiumClass(index);
            var brokerBadge = brokerIdentityMarkup(broker, rawBrokerName);
            return [
                "<tr" + rowClass + ">",
                "<td class=\"rank\">#" + (index + 1) + "</td>",
                "<td><span class=\"runner-name\">" + escapeHtml(String(entry.display_name || "Player")) + "</span></td>",
                "<td class=\"metric-value\">" + score + "</td>",
                "<td>" + formatInteger(entry.level) + "</td>",
                "<td><span class=\"broker-cell\">" + brokerBadge + "<span>" + brokerName + "</span></span></td>",
                "<td>" + platform + "</td>",
                "</tr>"
            ].join("");
        }).join("");
    }

    function podiumClass(index) {
        if (index === 0) {
            return " class=\"first-place\"";
        }
        if (index === 1) {
            return " class=\"second-place\"";
        }
        if (index === 2) {
            return " class=\"third-place\"";
        }
        return "";
    }

    function renderError(message) {
        elements.body.innerHTML = "<tr class=\"empty-row\"><td colspan=\"6\">" + escapeHtml(message) + "</td></tr>";
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
        var number = Number(value || 0);
        return new Intl.NumberFormat(undefined, {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }).format(number);
    }

    function formatInteger(value) {
        var number = Number(value || 0);
        return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(number);
    }

    function escapeHtml(value) {
        return value.replace(/[&<>"']/g, function (character) {
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
    document.querySelectorAll("input[type=\"radio\"]").forEach(function (input) {
        input.addEventListener("change", refreshLeaderboard);
    });
    elements.button.addEventListener("click", refreshLeaderboard);
    document.getElementById("board-code").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            refreshLeaderboard();
        }
    });
    refreshLeaderboard();
    window.setInterval(refreshLeaderboard, AUTO_REFRESH_MS);
})();
