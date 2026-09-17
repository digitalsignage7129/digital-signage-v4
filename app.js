/* ========================================
   DIGITAL SIGNAGE TOUCH V4
   CMS APP
======================================== */

const BUCKET_NAME = "v4-media";

let currentUser = null;
let sites = [];
let currentContentSiteId = "";
let currentScheduleSiteId = "";


/* ========================================
   ELEMENTS
======================================== */

const loginScreen = document.getElementById("loginScreen");
const cmsScreen = document.getElementById("cmsScreen");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");
const loginButton = document.getElementById("loginButton");
const loginMessage = document.getElementById("loginMessage");

const logoutButton = document.getElementById("logoutButton");
const loginUser = document.getElementById("loginUser");

const navButtons = document.querySelectorAll(".nav-button");
const pages = document.querySelectorAll(".page");
const pageTitle = document.getElementById("pageTitle");

const newSiteButton = document.getElementById("newSiteButton");
const siteList = document.getElementById("siteList");

const contentSiteSelect =
  document.getElementById("contentSiteSelect");

const scheduleSiteSelect =
  document.getElementById("scheduleSiteSelect");

const scheduleRows =
  document.getElementById("scheduleRows");

const addScheduleRowButton =
  document.getElementById("addScheduleRowButton");

const tickerText =
  document.getElementById("tickerText");

const saveScheduleButton =
  document.getElementById("saveScheduleButton");

const playerList =
  document.getElementById("playerList");

const customerList =
  document.getElementById("customerList");

const newCustomerButton =
  document.getElementById("newCustomerButton");

/* ========================================
   INITIALIZE
======================================== */

document.addEventListener("DOMContentLoaded", async () => {

  setupNavigation();
  setupContentEditors();
  setupScheduleEvents();
  setupCustomerEvents();

  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (session) {
    await enterCMS(session.user);
  } else {
    showLogin();
  }

});


/* ========================================
   LOGIN
======================================== */

loginButton.addEventListener("click", async () => {

  loginMessage.textContent = "";

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    loginMessage.textContent =
      "メールアドレスとパスワードを入力してください。";
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "ログイン中...";

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  loginButton.disabled = false;
  loginButton.textContent = "ログイン";

  if (error) {
    console.error(error);

    loginMessage.textContent =
      "ログインに失敗しました。入力内容をご確認ください。";

    return;
  }

  await enterCMS(data.user);

});


logoutButton.addEventListener("click", async () => {

  await supabaseClient.auth.signOut();

  currentUser = null;
  sites = [];

  loginPassword.value = "";

  showLogin();

});


function showLogin() {

  loginScreen.classList.remove("hidden");
  cmsScreen.classList.add("hidden");

}


async function enterCMS(user) {
  currentUser = user;

  loginScreen.classList.add("hidden");
  cmsScreen.classList.remove("hidden");

  loginUser.textContent = user.email || "";

  // 로그인 계정의 권한 확인
  const { data: profile, error: profileError } = await supabaseClient
    .from("v4_profiles")
    .select("role, is_active")
    .eq("user_id", user.id)
    .single();

  if (profileError || !profile || !profile.is_active) {
    console.error("Profile error:", profileError);
    alert("アカウント情報を確認できません。");
    await supabaseClient.auth.signOut();
    showLogin();
    return;
  }

  currentUser.role = profile.role;
newSiteButton.style.display =
  profile.role === "admin" ? "" : "none";
   
  // 관리자 전용 메뉴 표시/숨김
  document.querySelectorAll(".admin-only").forEach((element) => {
    element.style.display =
      profile.role === "admin" ? "" : "none";
  });

  await loadSites();

  // 플레이어 관리는 관리자만 불러오기
  if (profile.role === "admin") {
    await loadPlayers();
  }
}


/* ========================================
   NAVIGATION
======================================== */

function setupNavigation() {

  navButtons.forEach(button => {

    button.addEventListener("click", async () => {

      navButtons.forEach(btn =>
        btn.classList.remove("active")
      );

      button.classList.add("active");

      const targetPage =
        button.dataset.page;

      pages.forEach(page =>
        page.classList.remove("active")
      );

      const page =
        document.getElementById(`page-${targetPage}`);

      if (page) {
        page.classList.add("active");
      }

      const titles = {
  sites: "現場管理",
  content: "コンテンツ管理",
  schedule: "週間工程",
  players: "プレイヤー管理",
  customers: "顧客管理"
};

      pageTitle.textContent =
        titles[targetPage] || "";

      if (targetPage === "sites") {
        await loadSites();
      }

      if (targetPage === "content") {
        await loadContentForSelectedSite();
      }

      if (targetPage === "schedule") {
        await loadScheduleForSelectedSite();
      }

      if (targetPage === "players") {
        await loadPlayers();
      }

       if (targetPage === "customers") {
  await loadCustomers();
}
    });

  });

}


/* ========================================
   SITE MANAGEMENT
======================================== */

newSiteButton.addEventListener("click", () => {

  openSiteModal();

});


async function loadSites() {

  const { data, error } =
    await supabaseClient
      .from("v4_sites")
      .select("*")
      .order("created_at", {
        ascending: false
      });

  if (error) {

    console.error(error);

    alert(
      "現場情報の取得に失敗しました。\n" +
      error.message
    );

    return;
  }

  sites = data || [];

  renderSites();
  updateSiteSelectors();

}


function renderSites() {

  siteList.innerHTML = "";

  if (sites.length === 0) {

    siteList.innerHTML = `
      <div class="site-card">
        <h3>登録された現場はありません</h3>
        <p>
          「＋ 新規現場」から最初の現場を登録してください。
        </p>
      </div>
    `;

    return;
  }

  sites.forEach(site => {

    const card =
      document.createElement("article");

    card.className = "site-card";

    const logoHtml =
      site.contractor_logo_url
        ? `
          <div class="site-card-logo">
            <img
              src="${escapeHtml(site.contractor_logo_url)}"
              alt="logo"
            >
          </div>
        `
        : `
          <div class="site-card-logo">
            <span style="
              color:#9aabba;
              font-size:13px;
            ">
              LOGO
            </span>
          </div>
        `;

    card.innerHTML = `
      ${logoHtml}

      <h3>
        ${escapeHtml(site.site_name)}
      </h3>

      <p>
        ${
          escapeHtml(
            site.contractor_name ||
            "ゼネコン名未設定"
          )
        }
      </p>

      <div style="
        display:flex;
        gap:8px;
        margin-top:20px;
      ">
        <button
          class="secondary-button edit-site-button"
          data-id="${site.id}"
        >
          編集
        </button>
      </div>
    `;

    siteList.appendChild(card);

  });


  document
    .querySelectorAll(".edit-site-button")
    .forEach(button => {

      button.addEventListener("click", () => {

        const site =
          sites.find(
            item =>
              item.id === button.dataset.id
          );

        if (site) {
          openSiteModal(site);
        }

      });

    });

}


function updateSiteSelectors() {

  const selectors = [
    contentSiteSelect,
    scheduleSiteSelect
  ];

  selectors.forEach(select => {

    const previous =
      select.value;

    select.innerHTML = "";

    if (sites.length === 0) {

      const option =
        document.createElement("option");

      option.value = "";
      option.textContent =
        "現場を登録してください";

      select.appendChild(option);

      return;
    }

    sites.forEach(site => {

      const option =
        document.createElement("option");

      option.value = site.id;

      option.textContent =
        site.contractor_name
          ? `${site.contractor_name} / ${site.site_name}`
          : site.site_name;

      select.appendChild(option);

    });

    if (
      previous &&
      sites.some(site =>
        site.id === previous
      )
    ) {
      select.value = previous;
    }

  });


  if (sites.length > 0) {

    if (!currentContentSiteId) {
      currentContentSiteId =
        contentSiteSelect.value;
    }

    if (!currentScheduleSiteId) {
      currentScheduleSiteId =
        scheduleSiteSelect.value;
    }

  }

}


/* ========================================
   SITE MODAL
======================================== */

function openSiteModal(site = null) {

  const isEdit = !!site;

  const overlay =
    document.createElement("div");

  overlay.style.cssText = `
    position:fixed;
    inset:0;
    background:rgba(14,40,62,.48);
    z-index:9999;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:20px;
  `;

  const modal =
    document.createElement("div");

  modal.style.cssText = `
    width:560px;
    max-width:100%;
    max-height:90vh;
    overflow:auto;
    background:white;
    border-radius:20px;
    padding:30px;
    box-shadow:0 25px 70px rgba(0,0,0,.20);
  `;

  modal.innerHTML = `
    <h2 style="
      color:#12385f;
      margin-bottom:6px;
    ">
      ${isEdit ? "現場情報を編集" : "新規現場"}
    </h2>

    <p style="
      color:#74879a;
      font-size:13px;
      margin-bottom:25px;
    ">
      サイネージに表示する現場情報を設定します。
    </p>

    <label style="
      display:block;
      font-weight:700;
      margin-bottom:7px;
    ">
      現場名 *
    </label>

    <input
      id="modalSiteName"
      class="modal-input"
      value="${
        escapeHtml(site?.site_name || "")
      }"
      placeholder="例：○○新築工事"
    >

    <label style="
      display:block;
      font-weight:700;
      margin:18px 0 7px;
    ">
      ゼネコン名
    </label>

    <input
      id="modalContractorName"
      class="modal-input"
      value="${
        escapeHtml(
          site?.contractor_name || ""
        )
      }"
      placeholder="例：株式会社○○建設"
    >

    <label style="
      display:block;
      font-weight:700;
      margin:18px 0 7px;
    ">
      ゼネコンロゴ
    </label>

    <input
      id="modalLogoFile"
      type="file"
      accept="image/*"
      class="modal-input"
    >

    ${
      site?.contractor_logo_url
        ? `
          <div style="margin-top:12px;">
            <img
              src="${escapeHtml(site.contractor_logo_url)}"
              style="
                max-width:180px;
                max-height:70px;
                object-fit:contain;
              "
            >
          </div>
        `
        : ""
    }

    <label style="
      display:block;
      font-weight:700;
      margin:18px 0 7px;
    ">
      天気表示地域
    </label>

    <select
      id="modalWeatherRegion"
      class="modal-select"
    >
      ${buildWeatherRegionOptions(
        site?.weather_region || "national"
      )}
    </select>

    <div style="
      display:flex;
      justify-content:flex-end;
      gap:10px;
      margin-top:28px;
    ">
      <button
        id="modalCancelButton"
        class="secondary-button"
      >
        キャンセル
      </button>

      <button
        id="modalSaveButton"
        class="primary-button"
      >
        保存
      </button>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);


  document
    .getElementById("modalCancelButton")
    .addEventListener(
      "click",
      () => overlay.remove()
    );


  overlay.addEventListener(
    "click",
    event => {

      if (event.target === overlay) {
        overlay.remove();
      }

    }
  );


  document
    .getElementById("modalSaveButton")
    .addEventListener(
      "click",
      async () => {

        await saveSiteFromModal(
          site,
          overlay
        );

      }
    );

}


function buildWeatherRegionOptions(selected) {

  const regions = [
    ["national", "全国"],
    ["hokkaido", "北海道"],
    ["tohoku", "東北"],
    ["kanto", "関東"],
    ["hokuriku", "北陸"],
    ["tokai", "東海"],
    ["kinki", "近畿"],
    ["chugoku", "中国"],
    ["shikoku", "四国"],
    ["kyushu", "九州"],
    ["okinawa", "沖縄"]
  ];

  return regions
    .map(([value, label]) => `
      <option
        value="${value}"
        ${value === selected ? "selected" : ""}
      >
        ${label}
      </option>
    `)
    .join("");

}


async function saveSiteFromModal(
  existingSite,
  overlay
) {

  const siteName =
    document
      .getElementById("modalSiteName")
      .value
      .trim();

  const contractorName =
    document
      .getElementById(
        "modalContractorName"
      )
      .value
      .trim();

  const weatherRegion =
    document
      .getElementById(
        "modalWeatherRegion"
      )
      .value;

  const logoFile =
    document
      .getElementById(
        "modalLogoFile"
      )
      .files[0];

  if (!siteName) {

    alert("現場名を入力してください。");
    return;

  }

  const saveButton =
    document.getElementById(
      "modalSaveButton"
    );

  saveButton.disabled = true;
  saveButton.textContent = "保存中...";


  try {

    let siteId =
      existingSite?.id || null;

    let logoUrl =
      existingSite?.contractor_logo_url ||
      null;


    /* -------------------------
       NEW SITE
    ------------------------- */

    if (!existingSite) {

      const {
        data: createdSite,
        error
      } =
        await supabaseClient
          .from("v4_sites")
          .insert({
            site_name: siteName,
            contractor_name:
              contractorName || null,
            weather_region:
              weatherRegion,
            ticker_text: ""
          })
          .select()
          .single();

      if (error) {
        throw error;
      }

      siteId = createdSite.id;


      /* 기본 메뉴 3개 생성 */

      const { error: menuError } =
        await supabaseClient
          .from("v4_content_menus")
          .insert([
            {
              site_id: siteId,
              menu_position: 1,
              menu_title: "現場案内",
              content_type: "image"
            },
            {
              site_id: siteId,
              menu_position: 2,
              menu_title: "安全情報",
              content_type: "image"
            },
            {
              site_id: siteId,
              menu_position: 3,
              menu_title: "お知らせ",
              content_type: "image"
            }
          ]);

      if (menuError) {
        throw menuError;
      }

    }


    /* -------------------------
       LOGO UPLOAD
    ------------------------- */

    if (logoFile) {

      logoUrl =
        await uploadFile(
          logoFile,
          `${siteId}/logo`
        );

    }


    /* -------------------------
       UPDATE SITE
    ------------------------- */

    const { error: updateError } =
      await supabaseClient
        .from("v4_sites")
        .update({
          site_name: siteName,
          contractor_name:
            contractorName || null,
          contractor_logo_url:
            logoUrl,
          weather_region:
            weatherRegion,
          updated_at:
            new Date().toISOString()
        })
        .eq("id", siteId);

    if (updateError) {
      throw updateError;
    }


    overlay.remove();

    await loadSites();

    alert("現場情報を保存しました。");

  } catch (error) {

    console.error(error);

    alert(
      "保存に失敗しました。\n" +
      error.message
    );

    saveButton.disabled = false;
    saveButton.textContent = "保存";

  }

}


/* ========================================
   CONTENT MANAGEMENT
======================================== */

function setupContentEditors() {

  const editors =
    document.querySelectorAll(
      ".content-editor"
    );

  editors.forEach(editor => {

    const typeSelect =
      editor.querySelector(
        ".content-type"
      );

    typeSelect.addEventListener(
      "change",
      () => {
        renderContentInput(editor);
      }
    );

    editor
      .querySelector(
        ".save-menu-button"
      )
      .addEventListener(
        "click",
        async () => {
          await saveContentMenu(editor);

        }
      );

  });

}
         async function saveContentMenu(editor) {

  const siteId =
    contentSiteSelect.value;

  if (!siteId) {
    alert("対象現場を選択してください。");
    return;
  }


  const position =
    Number(editor.dataset.position);

  const title =
    editor
      .querySelector(".menu-title")
      .value
      .trim();

  const type =
    editor
      .querySelector(".content-type")
      .value;


  if (!title) {
    alert("メニュー名を入力してください。");
    return;
  }


  const button =
    editor.querySelector(
      ".save-menu-button"
    );

  button.disabled = true;
  button.textContent = "保存中...";


  try {

    let fileUrls = [];

    try {
      fileUrls =
        JSON.parse(
          editor.dataset.fileUrls ||
          "[]"
        );
    } catch {
      fileUrls = [];
    }

let deletedFileUrls = [];

try {
  deletedFileUrls =
    JSON.parse(
      editor.dataset.deletedFileUrls ||
      "[]"
    );
} catch {
  deletedFileUrls = [];
}
     
    let webUrl =
      editor.dataset.webUrl ||
      null;


    /* ========================================
       IMAGE / VIDEO / PDF
    ======================================== */

    if (
      type === "image" ||
      type === "video" ||
      type === "pdf"
    ) {

      const fileInput =
        editor.querySelector(
          ".content-files"
        );

      const newFiles =
        Array.from(
          fileInput?.files || []
        );


      /*
        기존 파일 + 새 파일 합계 최대 5개
      */

      if (
        fileUrls.length +
        newFiles.length >
        5
      ) {

        alert(
          "1メニューにつき最大5ファイルまで登録できます。"
        );

        button.disabled = false;
        button.textContent = "保存";

        return;
      }


      /*
        기존 파일은 유지하고
        새 파일만 추가 업로드
      */

      for (const file of newFiles) {

        const url =
          await uploadFile(
            file,
            `${siteId}/menu${position}/${type}`
          );

        fileUrls.push(url);

      }


      webUrl = null;

    }


    /* ========================================
       URL
    ======================================== */

    if (type === "url") {

      const urlInput =
        editor.querySelector(
          ".web-url"
        );

      webUrl =
        urlInput.value.trim();


      if (!webUrl) {

        alert(
          "WebページのURLを入力してください。"
        );

        button.disabled = false;
        button.textContent = "保存";

        return;
      }


      if (
        !/^https?:\/\//i.test(webUrl)
      ) {

        alert(
          "URLは http:// または https:// から入力してください。"
        );

        button.disabled = false;
        button.textContent = "保存";

        return;
      }


      fileUrls = [];

    }


    /*
      기존 Android / CMS와의 호환용 값

      새 구조의 기준은 file_urls.
      기존 컬럼은 당분간 유지.
    */

    let legacyContentUrl = null;
    let legacyImageUrls = [];


    if (type === "image") {

      legacyImageUrls =
        [...fileUrls];

    }


    if (
      type === "video" ||
      type === "pdf"
    ) {

      legacyContentUrl =
        fileUrls[0] || null;

    }


    const payload = {

      site_id: siteId,

      menu_position: position,

      menu_title: title,

      content_type: type,

      file_urls: fileUrls,

      /*
        구버전 호환
      */
      content_url:
        legacyContentUrl,

      image_urls:
        legacyImageUrls,

      web_url:
        webUrl,

      is_active: true,

      updated_at:
        new Date().toISOString()

    };


    const { error } =
      await supabaseClient
        .from("v4_content_menus")
        .upsert(
          payload,
          {
            onConflict:
              "site_id,menu_position"
          }
        );


    if (error) {
      throw error;
    }

// 保存 성공 후, 삭제 예정 파일을 Storage에서도 실제 삭제
for (const url of deletedFileUrls) {

  try {
    const marker = `/storage/v1/object/public/${BUCKET_NAME}/`;
    const markerIndex = url.indexOf(marker);

    if (markerIndex === -1) {
      console.warn("Storage path를 찾을 수 없음:", url);
      continue;
    }

    const path =
      decodeURIComponent(
        url.substring(markerIndex + marker.length)
      );

    const { error: removeError } =
      await supabaseClient
        .storage
        .from(BUCKET_NAME)
        .remove([path]);

    if (removeError) {
      throw removeError;
    }

  } catch (removeError) {
    console.error(
      "Storage file delete error:",
      removeError
    );
  }
}

// 삭제 완료 후 삭제 예정 목록 초기화
editor.dataset.deletedFileUrls = "[]";
     
    button.disabled = false;
    button.textContent = "保存";


    await loadContentForSelectedSite();


    alert(
      `MENU ${String(position).padStart(2, "0")} を保存しました。`
    );


  } catch (error) {

    console.error(error);

    button.disabled = false;
    button.textContent = "保存";

    alert(
      "コンテンツの保存に失敗しました。\n" +
      error.message
    );

  }

}


async function loadContentForSelectedSite() {

  const siteId =
    contentSiteSelect.value;

  currentContentSiteId = siteId;

  if (!siteId) {
    return;
  }

  const { data, error } =
    await supabaseClient
      .from("v4_content_menus")
      .select("*")
      .eq("site_id", siteId)
      .order(
        "menu_position",
        { ascending: true }
      );

  if (error) {

    console.error(error);

    alert(
      "コンテンツ情報の取得に失敗しました。"
    );

    return;
  }

  const menus = data || [];

  document
    .querySelectorAll(
      ".content-editor"
    )
    .forEach(editor => {

      const position =
        Number(
          editor.dataset.position
        );

      const menu =
        menus.find(
          item =>
            item.menu_position ===
            position
        );

      const titleInput =
        editor.querySelector(
          ".menu-title"
        );

      const typeSelect =
        editor.querySelector(
          ".content-type"
        );

      if (!menu) {

        titleInput.value = "";
        typeSelect.value = "image";

        renderContentInput(editor);

        return;
      }

      titleInput.value =
        menu.menu_title || "";

      typeSelect.value =
        menu.content_type ||
        "image";

      editor.dataset.menuId =
        menu.id;

      editor.dataset.contentUrl =
        menu.content_url || "";

      editor.dataset.imageUrls =
        JSON.stringify(
          menu.image_urls || []
        );

       editor.dataset.fileUrls =
  JSON.stringify(
    menu.file_urls || []
  );
       
      editor.dataset.webUrl =
        menu.web_url || "";

      renderContentInput(
        editor,
        menu
      );

    });

}


function renderContentInput(
  editor,
  menuData = null
) {

  const type =
    editor
      .querySelector(".content-type")
      .value;

  const area =
    editor.querySelector(
      ".content-input-area"
    );

  area.innerHTML = "";


  /* ========================================
     IMAGE / VIDEO / PDF
  ======================================== */

  if (
    type === "image" ||
    type === "video" ||
    type === "pdf"
  ) {

    let accept = "";
    let label = "";

    if (type === "image") {
      accept = "image/*";
      label = "画像";
    }

    if (type === "video") {
      accept = "video/*";
      label = "動画ファイル";
    }

    if (type === "pdf") {
      accept = "application/pdf";
      label = "PDFファイル";
    }


    /*
      새 file_urls 우선 사용.
      기존 데이터와의 호환도 유지.
    */

    let existingUrls = [];

    if (
      Array.isArray(menuData?.file_urls) &&
      menuData.file_urls.length > 0
    ) {

      existingUrls =
        [...menuData.file_urls];

    } else if (
      type === "image" &&
      Array.isArray(menuData?.image_urls)
    ) {

      existingUrls =
        [...menuData.image_urls];

    } else if (
      (type === "video" || type === "pdf") &&
      menuData?.content_url
    ) {

      existingUrls = [
        menuData.content_url
      ];

    }


    /*
      현재 유지할 파일을 editor에 저장
    */

    editor.dataset.fileUrls =
      JSON.stringify(existingUrls);


    area.innerHTML = `
      <label style="margin-top:0;">
        ${label}
      </label>

      <input
        type="file"
        class="content-files"
        accept="${accept}"
        multiple
      >

      <p style="
        margin-top:8px;
        color:#74879a;
        font-size:12px;
      ">
        最大5ファイルまで登録できます。
        1ファイルずつ追加することも、
        複数ファイルをまとめて選択することもできます。
      </p>

      <div
        class="registered-file-list"
        style="
          margin-top:12px;
          display:flex;
          flex-direction:column;
          gap:8px;
        "
      ></div>
    `;


    const list =
      area.querySelector(
        ".registered-file-list"
      );


    function renderExistingFiles() {

      let urls = [];

      try {

        urls =
          JSON.parse(
            editor.dataset.fileUrls ||
            "[]"
          );

      } catch {

        urls = [];

      }


      list.innerHTML = "";


      if (urls.length === 0) {

        list.innerHTML = `
          <p style="
            margin:0;
            color:#9aabba;
            font-size:12px;
          ">
            登録済みファイルはありません。
          </p>
        `;

        return;
      }


      urls.forEach((url, index) => {

        const row =
          document.createElement("div");

        row.style.cssText = `
          display:flex;
          align-items:center;
          justify-content:space-between;
          gap:10px;
          padding:10px 12px;
          background:#f4f8fb;
          border:1px solid #dce7ef;
          border-radius:8px;
        `;


        let previewHtml = "";

        if (type === "image") {

          previewHtml = `
            <img
              src="${escapeHtml(url)}"
              alt=""
              style="
                width:54px;
                height:40px;
                object-fit:cover;
                border-radius:5px;
                flex-shrink:0;
              "
            >
          `;

        }


        row.innerHTML = `
          <div style="
            display:flex;
            align-items:center;
            gap:10px;
            min-width:0;
          ">

            ${previewHtml}

            <span style="
              font-size:12px;
              color:#526779;
              overflow:hidden;
              text-overflow:ellipsis;
              white-space:nowrap;
            ">
              登録済みファイル ${index + 1}
            </span>

          </div>

          <button
            type="button"
            class="remove-existing-file"
            data-index="${index}"
            style="
              border:1px solid #d8e1e8;
              background:#fff;
              border-radius:6px;
              padding:5px 10px;
              cursor:pointer;
              flex-shrink:0;
            "
          >
            削除
          </button>
        `;

        list.appendChild(row);

      });


      list
        .querySelectorAll(
          ".remove-existing-file"
        )
        .forEach(button => {

          button.addEventListener(
            "click",
            () => {

              let current = [];

              try {

                current =
                  JSON.parse(
                    editor.dataset.fileUrls ||
                    "[]"
                  );

              } catch {

                current = [];

              }

              const index =
                Number(
                  button.dataset.index
                );

              const removedUrl = current[index];

let deleted = [];

try {
  deleted =
    JSON.parse(
      editor.dataset.deletedFileUrls ||
      "[]"
    );
} catch {
  deleted = [];
}

if (removedUrl && !deleted.includes(removedUrl)) {
  deleted.push(removedUrl);
}

editor.dataset.deletedFileUrls =
  JSON.stringify(deleted);

current.splice(index, 1);

editor.dataset.fileUrls =
  JSON.stringify(current);

renderExistingFiles();
            }
          );

        });

    }


    renderExistingFiles();


    /*
      새로 선택하는 파일까지 합쳐
      최대 5개인지 즉시 검사
    */

    const fileInput =
      area.querySelector(
        ".content-files"
      );

    fileInput.addEventListener(
      "change",
      () => {

        let existing = [];

        try {

          existing =
            JSON.parse(
              editor.dataset.fileUrls ||
              "[]"
            );

        } catch {

          existing = [];

        }

        const selectedCount =
          fileInput.files.length;

        if (
          existing.length +
          selectedCount >
          5
        ) {

          alert(
            "1メニューにつき最大5ファイルまで登録できます。"
          );

          fileInput.value = "";

        }

      }
    );


    return;
  }


  /* ========================================
     URL
  ======================================== */

  if (type === "url") {

    area.innerHTML = `
      <label style="margin-top:0;">
        Webページ URL
      </label>

      <input
        type="url"
        class="web-url"
        placeholder="https://example.com"
        value="${
          escapeHtml(
            menuData?.web_url || ""
          )
        }"
      >

      <p style="
        margin-top:8px;
        color:#74879a;
        font-size:12px;
      ">
        サイネージではWebページとして表示されます。
      </p>
    `;

  }

}


/* ========================================
   WEEKLY SCHEDULE
======================================== */

function setupScheduleEvents() {

  addScheduleRowButton.addEventListener(
    "click",
    () => addScheduleRow()
  );


  scheduleSiteSelect.addEventListener(
    "change",
    async () => {

      currentScheduleSiteId =
        scheduleSiteSelect.value;

      await loadScheduleForSelectedSite();

    }
  );


  saveScheduleButton.addEventListener(
    "click",
    saveSchedule
  );

}


function addScheduleRow(
  data = null
) {

  const row =
    document.createElement("div");

  row.className = "schedule-row";

  row.innerHTML = `
    <div>
      <input
        type="date"
        class="schedule-date"
        value="${
          escapeHtml(
            data?.work_date || ""
          )
        }"
      >
    </div>

    <div class="schedule-weekday">
      ${
        data?.work_date
          ? getJapaneseWeekday(
              data.work_date
            )
          : "－"
      }
    </div>

    <div style="
      display:flex;
      gap:8px;
      align-items:center;
    ">
      <input
        type="text"
        class="schedule-content"
        value="${
          escapeHtml(
            data?.work_content || ""
          )
        }"
        placeholder="作業内容を入力"
      >

      <button
        type="button"
        class="delete-schedule-row"
        title="削除"
        style="
          flex:0 0 auto;
          border:none;
          background:#f6eaea;
          color:#b64747;
          border-radius:8px;
          width:38px;
          height:38px;
          font-weight:700;
        "
      >
        ×
      </button>
    </div>
  `;


  const dateInput =
    row.querySelector(
      ".schedule-date"
    );

  const weekday =
    row.querySelector(
      ".schedule-weekday"
    );

  dateInput.addEventListener(
    "change",
    () => {

      weekday.textContent =
        dateInput.value
          ? getJapaneseWeekday(
              dateInput.value
            )
          : "－";

    }
  );


  row
    .querySelector(
      ".delete-schedule-row"
    )
    .addEventListener(
      "click",
      () => row.remove()
    );


  scheduleRows.appendChild(row);

}


function getJapaneseWeekday(dateString) {

  if (!dateString) {
    return "";
  }

  const date =
    new Date(
      `${dateString}T00:00:00`
    );

  const weekdays = [
    "日",
    "月",
    "火",
    "水",
    "木",
    "金",
    "土"
  ];

  return weekdays[
    date.getDay()
  ];

}


async function loadScheduleForSelectedSite() {

  const siteId =
    scheduleSiteSelect.value;

  currentScheduleSiteId =
    siteId;

  scheduleRows.innerHTML = "";
  tickerText.value = "";

  if (!siteId) {
    return;
  }


  const {
    data: scheduleData,
    error: scheduleError
  } =
    await supabaseClient
      .from("v4_weekly_schedule")
      .select("*")
      .eq("site_id", siteId)
      .order(
        "work_date",
        { ascending: true }
      )
      .order(
        "display_order",
        { ascending: true }
      );


  if (scheduleError) {

    console.error(
      scheduleError
    );

    alert(
      "週間工程の取得に失敗しました。"
    );

    return;
  }


  if (
    !scheduleData ||
    scheduleData.length === 0
  ) {

    for (let i = 0; i < 7; i++) {
      addScheduleRow();
    }

  } else {

    scheduleData.forEach(
      item =>
        addScheduleRow(item)
    );

  }


  const {
    data: siteData,
    error: siteError
  } =
    await supabaseClient
      .from("v4_sites")
      .select("ticker_text")
      .eq("id", siteId)
      .single();


  if (!siteError && siteData) {

    tickerText.value =
      siteData.ticker_text || "";

  }

}


async function saveSchedule() {

  const siteId =
    scheduleSiteSelect.value;

  if (!siteId) {

    alert("対象現場を選択してください。");
    return;

  }


  const rows =
    Array.from(
      scheduleRows.querySelectorAll(
        ".schedule-row"
      )
    );

  const scheduleData = [];


  for (
    let index = 0;
    index < rows.length;
    index++
  ) {

    const row = rows[index];

    const workDate =
      row.querySelector(
        ".schedule-date"
      ).value;

    const workContent =
      row.querySelector(
        ".schedule-content"
      ).value.trim();


    if (
      !workDate &&
      !workContent
    ) {
      continue;
    }


    if (!workDate) {

      alert(
        "作業内容が入力されている行には日付を設定してください。"
      );

      return;
    }


    scheduleData.push({
      site_id: siteId,
      work_date: workDate,
      work_content:
        workContent,
      display_order:
        scheduleData.length
    });

  }


  saveScheduleButton.disabled = true;
  saveScheduleButton.textContent =
    "保存中...";


  try {

    /*
      이 CMS에서는 현재 화면에 입력된
      주간공정 전체를 최신 데이터로 사용한다.
    */

    const { error: deleteError } =
      await supabaseClient
        .from("v4_weekly_schedule")
        .delete()
        .eq("site_id", siteId);

    if (deleteError) {
      throw deleteError;
    }


    if (scheduleData.length > 0) {

      const { error: insertError } =
        await supabaseClient
          .from("v4_weekly_schedule")
          .insert(scheduleData);

      if (insertError) {
        throw insertError;
      }

    }


    const { error: tickerError } =
      await supabaseClient
        .from("v4_sites")
        .update({
          ticker_text:
            tickerText.value.trim(),
          updated_at:
            new Date().toISOString()
        })
        .eq("id", siteId);

    if (tickerError) {
      throw tickerError;
    }


    saveScheduleButton.disabled =
      false;

    saveScheduleButton.textContent =
      "週間工程・テロップを保存";


    await loadScheduleForSelectedSite();

    alert(
      "週間工程・テロップを保存しました。"
    );

  } catch (error) {

    console.error(error);

    saveScheduleButton.disabled =
      false;

    saveScheduleButton.textContent =
      "週間工程・テロップを保存";

    alert(
      "保存に失敗しました。\n" +
      error.message
    );

  }

}


/* ========================================
   PLAYER MANAGEMENT
======================================== */

async function loadPlayers() {

  const { data, error } =
    await supabaseClient
      .from("v4_devices")
      .select("*")
      .order(
        "created_at",
        { ascending: false }
      );

  if (error) {

    console.error(error);

    playerList.innerHTML = `
      <div class="player-card">
        プレイヤー情報を取得できませんでした。
      </div>
    `;

    return;
  }


  renderPlayers(data || []);

}


function renderPlayers(devices) {

  playerList.innerHTML = "";


  if (devices.length === 0) {

    playerList.innerHTML = `
      <div class="player-card">
        <div>
          登録待ちのプレイヤーはありません。
        </div>
      </div>
    `;

    return;
  }


  devices.forEach(device => {

    const card =
      document.createElement("div");

    card.className =
      "player-card";


    const siteOptions =
      [
        `<option value="">
          未接続
        </option>`
      ]
      .concat(
        sites.map(site => `
          <option
            value="${site.id}"
            ${
              device.site_id ===
              site.id
                ? "selected"
                : ""
            }
          >
            ${
              escapeHtml(
                site.contractor_name
                  ? `${site.contractor_name} / ${site.site_name}`
                  : site.site_name
              )
            }
          </option>
        `)
      )
      .join("");


    card.innerHTML = `
      <div>
        <div style="
          color:#74879a;
          font-size:11px;
          margin-bottom:4px;
        ">
          登録コード
        </div>

        <div class="registration-code">
          ${
            escapeHtml(
              device.registration_code
            )
          }
        </div>
      </div>

      <div>
        <div style="
          color:#74879a;
          font-size:11px;
          margin-bottom:4px;
        ">
          プレイヤー名
        </div>

        <input
          type="text"
          class="player-name modal-input"
          value="${
            escapeHtml(
              device.device_name || ""
            )
          }"
          placeholder="例：現場入口"
        >
      </div>

      <div>
        <div style="
          color:#74879a;
          font-size:11px;
          margin-bottom:4px;
        ">
          接続現場
        </div>

        <select
          class="player-site modal-select"
        >
          ${siteOptions}
        </select>
      </div>

      <button
        class="primary-button save-player"
      >
        保存
      </button>
    `;


    card
      .querySelector(
        ".save-player"
      )
      .addEventListener(
        "click",
        async event => {

          const button =
            event.currentTarget;

          const deviceName =
            card
              .querySelector(
                ".player-name"
              )
              .value
              .trim();

          const siteId =
            card
              .querySelector(
                ".player-site"
              )
              .value;


          button.disabled = true;
          button.textContent =
            "保存中...";


          const { error } =
            await supabaseClient
              .from("v4_devices")
              .update({
                device_name:
                  deviceName || null,

                site_id:
                  siteId || null,

                updated_at:
                  new Date()
                    .toISOString()
              })
              .eq(
                "id",
                device.id
              );


          button.disabled = false;
          button.textContent =
            "保存";


          if (error) {

            console.error(error);

            alert(
              "プレイヤー設定の保存に失敗しました。"
            );

            return;
          }


          alert(
            "プレイヤー設定を保存しました。"
          );

          await loadPlayers();

        }
      );


    playerList.appendChild(card);

  });

}


/* ========================================
   STORAGE
======================================== */

async function uploadFile(
  file,
  folder
) {

  const extension =
    getFileExtension(file.name);

  const randomName =
    `${Date.now()}-${crypto.randomUUID()}` +
    (extension
      ? `.${extension}`
      : "");

  const path =
    `${folder}/${randomName}`;


  const { error } =
    await supabaseClient
      .storage
      .from(BUCKET_NAME)
      .upload(
        path,
        file,
        {
          cacheControl: "3600",
          upsert: false
        }
      );


  if (error) {
    throw error;
  }


  const { data } =
    supabaseClient
      .storage
      .from(BUCKET_NAME)
      .getPublicUrl(path);


  if (
    !data ||
    !data.publicUrl
  ) {

    throw new Error(
      "公開URLを取得できませんでした。"
    );

  }


  return data.publicUrl;

}


function getFileExtension(
  filename
) {

  const parts =
    filename.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts
    .pop()
    .toLowerCase()
    .replace(
      /[^a-z0-9]/g,
      ""
    );

}


/* ========================================
   UTILITIES
======================================== */

function escapeHtml(value) {

  if (
    value === null ||
    value === undefined
  ) {
    return "";
  }

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}

/* =========================================
   CUSTOMER MANAGEMENT
========================================= */

function setupCustomerEvents() {
  if (newCustomerButton) {
    newCustomerButton.addEventListener("click", () => {
      openCustomerModal();
    });
  }
}

async function loadCustomers() {
  if (!customerList || currentUser?.role !== "admin") {
    return;
  }

  customerList.innerHTML = `
    <div class="empty-state">
      読み込み中...
    </div>
  `;

  const { data: customers, error } = await supabaseClient
    .from("v4_profiles")
    .select(`
      user_id,
      email,
      display_name,
      role,
      is_active,
      created_at
    `)
    .eq("role", "customer")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Customer load error:", error);

    customerList.innerHTML = `
      <div class="empty-state">
        顧客情報を読み込めませんでした。
      </div>
    `;
    return;
  }

  if (!customers || customers.length === 0) {
    customerList.innerHTML = `
      <div class="empty-state">
        まだ顧客アカウントがありません。
      </div>
    `;
    return;
  }

  const { data: userSites, error: siteError } = await supabaseClient
    .from("v4_user_sites")
    .select(`
      user_id,
      site_id,
      v4_sites (
        id,
        site_name
      )
    `);

  if (siteError) {
    console.error("Customer site load error:", siteError);
  }

  customerList.innerHTML = "";

  customers.forEach((customer) => {
    const assignedSites = (userSites || [])
      .filter((item) => item.user_id === customer.user_id)
      .map((item) => item.v4_sites)
      .filter(Boolean);

    const card = document.createElement("div");
    card.className = "customer-card";

    card.innerHTML = `
      <div class="customer-info">

        <h3>
          ${escapeHtml(customer.display_name || "名称未設定")}
        </h3>

        <p class="customer-email">
          ${escapeHtml(customer.email || "")}
        </p>

        <div class="customer-sites">
          ${
            assignedSites.length
              ? assignedSites
                  .map(
                    (site) => `
                      <span class="customer-site-badge">
                        ${escapeHtml(site.site_name)}
                      </span>
                    `
                  )
                  .join("")
              : `
                  <span class="customer-site-badge">
                    担当現場なし
                  </span>
                `
          }
        </div>

      </div>

      <div class="customer-actions">

        <span class="customer-status ${
          customer.is_active ? "" : "inactive"
        }">
          ${customer.is_active ? "有効" : "無効"}
        </span>

        <button
          class="customer-action-button edit-customer-button"
          data-user-id="${customer.user_id}"
        >
          編集
        </button>

        <button
          class="customer-action-button reset-password-button"
          data-user-id="${customer.user_id}"
        >
          パスワード再設定
        </button>

        <button
          class="customer-action-button danger delete-customer-button"
          data-user-id="${customer.user_id}"
        >
          削除
        </button>

      </div>
    `;

    customerList.appendChild(card);
  });

  setupCustomerCardEvents(customers, userSites || []);
}
function openCustomerModal() {
  const overlay = document.createElement("div");
  overlay.className = "customer-modal-overlay";

  const siteOptions = (sites || [])
    .map(
      (site) => `
        <label class="customer-site-option">
          <input
            type="checkbox"
            class="customer-site-checkbox"
            value="${site.id}"
          >
          <span>${escapeHtml(site.site_name)}</span>
        </label>
      `
    )
    .join("");

  overlay.innerHTML = `
    <div class="customer-modal">
      <h2>新規顧客アカウント</h2>

      <label>顧客名</label>
      <input
        type="text"
        id="customerDisplayName"
        placeholder="例：株式会社〇〇"
      >

      <label>ログインメールアドレス</label>
      <input
        type="email"
        id="customerEmail"
        placeholder="example@company.co.jp"
      >

      <label>初期パスワード</label>
      <input
        type="password"
        id="customerPassword"
        placeholder="6文字以上"
      >

      <label>担当現場</label>

      <div class="customer-site-options">
        ${
          siteOptions ||
          `<p>登録されている現場がありません。</p>`
        }
      </div>

      <div class="customer-modal-actions">
        <button
          type="button"
          class="secondary-button"
          id="cancelCustomerButton"
        >
          キャンセル
        </button>

        <button
          type="button"
          class="primary-button"
          id="createCustomerButton"
        >
          顧客を作成
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("cancelCustomerButton")
    .addEventListener("click", () => {
      overlay.remove();
    });

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  document
    .getElementById("createCustomerButton")
    .addEventListener("click", async () => {
      await createCustomer(overlay);
    });
}


async function createCustomer(overlay) {
  const displayName =
    document.getElementById("customerDisplayName").value.trim();

  const email =
    document.getElementById("customerEmail").value.trim();

  const password =
    document.getElementById("customerPassword").value;

  const siteIds = Array.from(
    document.querySelectorAll(
      ".customer-site-checkbox:checked"
    )
  ).map((checkbox) => checkbox.value);

  if (!displayName) {
    alert("顧客名を入力してください。");
    return;
  }

  if (!email) {
    alert("メールアドレスを入力してください。");
    return;
  }

  if (password.length < 6) {
    alert("パスワードは6文字以上で入力してください。");
    return;
  }

  const button =
    document.getElementById("createCustomerButton");

  button.disabled = true;
  button.textContent = "作成中...";

  try {
    const { data, error } =
      await supabaseClient.functions.invoke(
        "v4-customer-admin",
        {
          body: {
            action: "create",
            display_name: displayName,
            email: email,
            password: password,
            site_ids: siteIds,
          },
        }
      );

    if (error) {
      throw error;
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    overlay.remove();

    await loadCustomers();

    alert("顧客アカウントを作成しました。");
  } catch (error) {
    console.error("Create customer error:", error);

    alert(
      error?.message ||
      "顧客アカウントを作成できませんでした。"
    );

    button.disabled = false;
    button.textContent = "顧客を作成";
  }
}

function setupCustomerCardEvents(customers, userSites) {
  document.querySelectorAll(".edit-customer-button").forEach((button) => {
    button.addEventListener("click", () => {
      const userId = button.dataset.userId;
      const customer = customers.find((item) => item.user_id === userId);

      if (!customer) return;

      const assignedSiteIds = userSites
        .filter((item) => item.user_id === userId)
        .map((item) => item.site_id);

      openEditCustomerModal(customer, assignedSiteIds);
    });
  });

  document.querySelectorAll(".reset-password-button").forEach((button) => {
    button.addEventListener("click", () => {
      resetCustomerPassword(button.dataset.userId);
    });
  });

  document.querySelectorAll(".delete-customer-button").forEach((button) => {
    button.addEventListener("click", () => {
      deleteCustomer(button.dataset.userId);
    });
  });
}


function openEditCustomerModal(customer, assignedSiteIds) {
  const overlay = document.createElement("div");
  overlay.className = "customer-modal-overlay";

  const siteOptions = (sites || [])
    .map(
      (site) => `
        <label class="customer-site-option">
          <input
            type="checkbox"
            class="edit-customer-site-checkbox"
            value="${site.id}"
            ${assignedSiteIds.includes(site.id) ? "checked" : ""}
          >
          <span>${escapeHtml(site.site_name)}</span>
        </label>
      `
    )
    .join("");

  overlay.innerHTML = `
    <div class="customer-modal">
      <h2>顧客アカウント編集</h2>

      <label>顧客名</label>
      <input
        type="text"
        id="editCustomerDisplayName"
        value="${escapeHtml(customer.display_name || "")}"
      >

      <label>ログインメールアドレス</label>
      <input
        type="email"
        id="editCustomerEmail"
        value="${escapeHtml(customer.email || "")}"
      >

      <label>担当現場</label>

      <div class="customer-site-options">
        ${
          siteOptions ||
          `<p>登録されている現場がありません。</p>`
        }
      </div>

      <div class="customer-modal-actions">
        <button
          type="button"
          class="secondary-button"
          id="cancelEditCustomerButton"
        >
          キャンセル
        </button>

        <button
          type="button"
          class="primary-button"
          id="saveEditCustomerButton"
        >
          保存
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document
    .getElementById("cancelEditCustomerButton")
    .addEventListener("click", () => overlay.remove());

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });

  document
    .getElementById("saveEditCustomerButton")
    .addEventListener("click", async () => {
      const displayName = document
        .getElementById("editCustomerDisplayName")
        .value.trim();

      const email = document
        .getElementById("editCustomerEmail")
        .value.trim();

      const siteIds = Array.from(
        document.querySelectorAll(
          ".edit-customer-site-checkbox:checked"
        )
      ).map((checkbox) => checkbox.value);

      if (!displayName || !email) {
        alert("顧客名とメールアドレスを入力してください。");
        return;
      }

      const saveButton =
        document.getElementById("saveEditCustomerButton");

      saveButton.disabled = true;
      saveButton.textContent = "保存中...";

      try {
        const { data, error } =
          await supabaseClient.functions.invoke(
            "v4-customer-admin",
            {
              body: {
                action: "update",
                user_id: customer.user_id,
                display_name: displayName,
                email: email,
                site_ids: siteIds,
              },
            }
          );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        overlay.remove();
        await loadCustomers();

        alert("顧客情報を更新しました。");
      } catch (error) {
        console.error("Update customer error:", error);

        alert(
          error?.message ||
          "顧客情報を更新できませんでした。"
        );

        saveButton.disabled = false;
        saveButton.textContent = "保存";
      }
    });
}


async function resetCustomerPassword(userId) {
  const newPassword = prompt(
    "新しいパスワードを入力してください。\n（6文字以上）"
  );

  if (newPassword === null) return;

  if (newPassword.length < 6) {
    alert("パスワードは6文字以上で入力してください。");
    return;
  }

  try {
    const { data, error } =
      await supabaseClient.functions.invoke(
        "v4-customer-admin",
        {
          body: {
            action: "reset_password",
            user_id: userId,
            new_password: newPassword,
          },
        }
      );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    alert("パスワードを変更しました。");
  } catch (error) {
    console.error("Reset password error:", error);

    alert(
      error?.message ||
      "パスワードを変更できませんでした。"
    );
  }
}


async function deleteCustomer(userId) {
  const confirmed = confirm(
    "この顧客アカウントを削除しますか？\n\n" +
    "顧客アカウントは削除されますが、現場・コンテンツ・週間工程のデータは削除されません。"
  );

  if (!confirmed) return;

  try {
    const { data, error } =
      await supabaseClient.functions.invoke(
        "v4-customer-admin",
        {
          body: {
            action: "delete",
            user_id: userId,
          },
        }
      );

    if (error) throw error;
    if (data?.error) throw new Error(data.error);

    await loadCustomers();

    alert("顧客アカウントを削除しました。");
  } catch (error) {
    console.error("Delete customer error:", error);

    alert(
      error?.message ||
      "顧客アカウントを削除できませんでした。"
    );
  }
}
