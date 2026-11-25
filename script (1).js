/* =========================================
   BAAN NECTAR - Shared JavaScript
   ใช้ร่วมกันในหน้า product.html, order.html และ admin.html
========================================= */

(() => {
  "use strict";

  const PRODUCTS_URL = "products.json";

  const ORDER_ENDPOINT =
    "https://script.google.com/macros/s/AKfycbxBn5K_rdgnSKbChV_h6Rf7dsl0LBJ4Po0qxpFz1tGofYK51g1M-zuspqR-aBsg0CN1/exec";

  const ORDERS_CSV_URL =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vSxdwOzCQii_MUkpJpXeNnSVGRHy9zWT8WN7zPh_MB_iA5CMJH1R64hdEa1XaTxPp0AV5lDZI-IsXwQ/pub?gid=0&single=true&output=csv";

  // ชื่อหมวดหมู่ต้องตรงกับค่า mood ใน products.json
  const HONEY_MOODS = [
    { value: "all", label: "ทั้งหมด" },
    { value: "wildflower", label: "Wildflower" },
    { value: "longan", label: "Longan" },
    { value: "lychee", label: "Lychee" },
    { value: "forest", label: "Forest" }
  ];

  const MOOD_LABELS = {
    wildflower: "Wildflower Honey",
    longan: "Longan Honey",
    lychee: "Lychee Honey",
    forest: "Forest Honey"
  };

  const money = (value) => {
    const number = Number(value);
    return Number.isFinite(number)
      ? `${number.toLocaleString("th-TH")} บาท`
      : `${value ?? ""} บาท`;
  };

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[character]);

  /* -----------------------------------------
     1. PRODUCT PAGE
     Element IDs: #filter-bar, #product-list
  ----------------------------------------- */

  async function initProductPage() {
    const filterBar = document.getElementById("filter-bar");
    const productList = document.getElementById("product-list");

    if (!filterBar || !productList) return;

    productList.innerHTML = '<p class="loading-message">กำลังโหลดสินค้า...</p>';

    let products;

    try {
      const response = await fetch(PRODUCTS_URL);
      if (!response.ok) throw new Error("ไม่สามารถโหลด products.json ได้");
      products = await response.json();
      if (!Array.isArray(products)) throw new Error("รูปแบบข้อมูลสินค้าไม่ถูกต้อง");
    } catch (error) {
      console.error(error);
      productList.innerHTML =
        '<p class="error-message">ไม่สามารถโหลดสินค้าได้ กรุณาลองใหม่อีกครั้ง</p>';
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const requestedMood = (params.get("mood") || "all").toLowerCase();
    const validMood = HONEY_MOODS.some((mood) => mood.value === requestedMood)
      ? requestedMood
      : "all";

    let activeMood = validMood;

    function renderFilters() {
      filterBar.innerHTML = HONEY_MOODS.map((mood) => `
        <button
          type="button"
          class="filter-button${mood.value === activeMood ? " active" : ""}"
          data-mood="${mood.value}"
          aria-pressed="${mood.value === activeMood}"
        >${mood.label}</button>
      `).join("");
    }

    function renderProducts() {
      const filteredProducts = activeMood === "all"
        ? products
        : products.filter((product) =>
            String(product.mood || "").toLowerCase() === activeMood
          );

      if (filteredProducts.length === 0) {
        productList.innerHTML = '<p class="empty-message">ไม่พบสินค้าที่เลือก</p>';
        return;
      }

      productList.innerHTML = filteredProducts.map((product) => {
        const itemName = `${product.name || "BAAN NECTAR Honey"} ${product.size || ""}`.trim();
        const orderURL = new URL("order.html", window.location.href);
        orderURL.searchParams.set("item", itemName);
        orderURL.searchParams.set("price", product.price);

        const moodLabel = MOOD_LABELS[product.mood] || "BAAN NECTAR Honey";

        return `
          <article class="product-card">
            <img
              class="product-image"
              src="${escapeHTML(product.image || "")}"
              alt="${escapeHTML(itemName)}"
              loading="lazy"
            >
            <div class="product-info">
              <span class="variety-label ${escapeHTML(product.mood || "")}">
                ${escapeHTML(moodLabel)}
              </span>
              <h3 class="product-name">${escapeHTML(product.name || "BAAN NECTAR Honey")}</h3>
              <p class="product-size">ขนาด ${escapeHTML(product.size || "-")}</p>
              <p class="product-description">${escapeHTML(product.description || "")}</p>
              <p class="product-price">${money(product.price)}</p>
              <a class="btn btn-primary" href="${escapeHTML(orderURL.href)}">สั่งซื้อ</a>
            </div>
          </article>
        `;
      }).join("");
    }

    filterBar.addEventListener("click", (event) => {
      const button = event.target.closest("[data-mood]");
      if (!button || !filterBar.contains(button)) return;

      activeMood = button.dataset.mood;
      renderFilters();
      renderProducts();

      const nextURL = new URL(window.location.href);
      if (activeMood === "all") {
        nextURL.searchParams.delete("mood");
      } else {
        nextURL.searchParams.set("mood", activeMood);
      }
      window.history.replaceState({}, "", nextURL);
    });

    renderFilters();
    renderProducts();
  }

  /* -----------------------------------------
     2. ORDER PAGE
     Element IDs:
     #orderForm, #customerName, #contact,
     #items, #total, #note
  ----------------------------------------- */

  function initOrderPage() {
    const form = document.getElementById("orderForm");
    if (!form) return;

    const customerNameInput = document.getElementById("customerName");
    const contactInput = document.getElementById("contact");
    const itemsInput = document.getElementById("items");
    const totalInput = document.getElementById("total");
    const noteInput = document.getElementById("note");

    const params = new URLSearchParams(window.location.search);
    const itemFromURL = params.get("item");
    const priceFromURL = params.get("price");

    // เติมชื่อสินค้าและราคาอัตโนมัติเมื่อเปิดหน้า order.html
    if (itemFromURL !== null && itemsInput) {
      itemsInput.value = itemFromURL;
      itemsInput.dispatchEvent(new Event("input", { bubbles: true }));
      itemsInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (priceFromURL !== null && totalInput) {
      totalInput.value = priceFromURL;
      totalInput.dispatchEvent(new Event("input", { bubbles: true }));
      totalInput.dispatchEvent(new Event("change", { bubbles: true }));
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();

      const payload = {
        customerName: customerNameInput?.value.trim() || "",
        contact: contactInput?.value.trim() || "",
        items: itemsInput?.value.trim() || "",
        total: totalInput?.value.trim() || "",
        note: noteInput?.value.trim() || ""
      };

      if (!payload.customerName || !payload.contact || !payload.items || !payload.total) {
        alert("กรุณากรอกชื่อผู้สั่งซื้อ ช่องทางติดต่อ รายการสินค้า และจำนวนเงินให้ครบถ้วน");
        return;
      }

      const submitButton = form.querySelector('[type="submit"]');
      if (submitButton) submitButton.disabled = true;

      fetch(ORDER_ENDPOINT, {
        method: "POST",
        body: JSON.stringify(payload)
      })
        .then(() => {
          window.location.href = "thankyou.html";
        })
        .catch((error) => {
          console.error(error);
          alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
          if (submitButton) submitButton.disabled = false;
        });
    });
  }

  /* -----------------------------------------
     3. ADMIN PAGE
     Element ID: #ordersTable tbody
     CSV parser supports commas and escaped quotes.
  ----------------------------------------- */

  function parseCSV(csvText) {
    const rows = [];
    let row = [];
    let cell = "";
    let insideQuotes = false;

    for (let index = 0; index < csvText.length; index += 1) {
      const character = csvText[index];
      const nextCharacter = csvText[index + 1];

      if (character === '"') {
        if (insideQuotes && nextCharacter === '"') {
          cell += '"';
          index += 1;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (character === "," && !insideQuotes) {
        row.push(cell);
        cell = "";
      } else if ((character === "\n" || character === "\r") && !insideQuotes) {
        if (character === "\r" && nextCharacter === "\n") index += 1;
        row.push(cell);
        if (row.some((value) => value.trim() !== "")) rows.push(row);
        row = [];
        cell = "";
      } else {
        cell += character;
      }
    }

    if (cell.length > 0 || row.length > 0) {
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
    }

    return rows;
  }

  function normalizeHeader(value) {
    return String(value || "")
      .replace(/^\uFEFF/, "")
      .trim()
      .toLowerCase()
      .replace(/[\s/_-]+/g, "");
  }

  function findColumn(headers, candidates, fallbackIndex) {
    const normalized = headers.map(normalizeHeader);
    for (const candidate of candidates) {
      const index = normalized.indexOf(normalizeHeader(candidate));
      if (index !== -1) return index;
    }
    return fallbackIndex;
  }

  function parseDate(value) {
    if (!value) return 0;

    // รองรับรูปแบบวันที่ไทย เช่น 25/11/2026 18:30
    const thaiDate = String(value).trim().match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
    );

    if (thaiDate) {
      let year = Number(thaiDate[3]);
      if (year > 2400) year -= 543;

      return new Date(
        year,
        Number(thaiDate[2]) - 1,
        Number(thaiDate[1]),
        Number(thaiDate[4] || 0),
        Number(thaiDate[5] || 0),
        Number(thaiDate[6] || 0)
      ).getTime() || 0;
    }

    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  async function initAdminPage() {
    const tableBody = document.querySelector("#ordersTable tbody");
    if (!tableBody) return;

    tableBody.innerHTML =
      '<tr><td colspan="6">กำลังโหลดข้อมูลคำสั่งซื้อ...</td></tr>';

    try {
      const response = await fetch(ORDERS_CSV_URL);
      if (!response.ok) throw new Error("ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้");

      const csvText = await response.text();
      const rows = parseCSV(csvText);

      if (rows.length < 2) {
        tableBody.innerHTML = '<tr><td colspan="6">ยังไม่มีข้อมูลคำสั่งซื้อ</td></tr>';
        return;
      }

      const headers = rows[0];

      // รองรับชื่อหัวตารางภาษาไทยและภาษาอังกฤษ
      const columns = {
        date: findColumn(headers, ["วันเวลา", "วันที่", "timestamp", "datetime", "date"], 0),
        customer: findColumn(headers, ["ชื่อลูกค้า", "ชื่อลูกค้า/ผู้สั่งซื้อ", "customerName", "customer"], 1),
        contact: findColumn(headers, ["เบอร์โทร/Line", "เบอร์โทร", "ช่องทางติดต่อ", "contact", "phone"], 2),
        items: findColumn(headers, ["รายการสินค้า", "สินค้า", "items", "product"], 3),
        total: findColumn(headers, ["จำนวนเงินรวม", "ยอดรวม", "ราคา", "total", "amount"], 4),
        note: findColumn(headers, ["หมายเหตุ", "note", "รายละเอียดเพิ่มเติม"], 5)
      };

      const orders = rows.slice(1).map((cells, originalIndex) => ({
        date: cells[columns.date] || "",
        customer: cells[columns.customer] || "",
        contact: cells[columns.contact] || "",
        items: cells[columns.items] || "",
        total: cells[columns.total] || "",
        note: cells[columns.note] || "",
        originalIndex
      }));

      orders.sort((a, b) => {
        const dateDifference = parseDate(b.date) - parseDate(a.date);
        return dateDifference || b.originalIndex - a.originalIndex;
      });

      tableBody.innerHTML = orders.map((order) => `
        <tr>
          <td>${escapeHTML(order.date)}</td>
          <td>${escapeHTML(order.customer)}</td>
          <td>${escapeHTML(order.contact)}</td>
          <td>${escapeHTML(order.items)}</td>
          <td>${escapeHTML(order.total)}</td>
          <td>${escapeHTML(order.note)}</td>
        </tr>
      `).join("");
    } catch (error) {
      console.error(error);
      tableBody.innerHTML =
        '<tr><td colspan="6">เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณารีเฟรชหน้าเว็บ</td></tr>';
    }
  }

  // เรียกเฉพาะส่วนที่มี element ของหน้านั้นอยู่จริง
  document.addEventListener("DOMContentLoaded", () => {
    initProductPage();
    initOrderPage();
    initAdminPage();
  });
})();
