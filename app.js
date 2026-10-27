// ---------- Auto-update check ----------
// iOS often "resumes" a home-screen app from memory instead of reloading it, so it can
// keep showing an old version indefinitely with no network request at all. This checks
// a tiny version file every time the app becomes visible, and silently reloads (no
// prompt) if a newer version has been published.
(function(){
  var VERSION_KEY = "appVersionSeen";
  function checkVersion(){
    fetch("version.json?_=" + Date.now(), {cache:"no-store"})
      .then(function(r){ return r.ok ? r.json() : null; })
      .then(function(data){
        if (!data || !data.v) return;
        var seen = null;
        try { seen = window.localStorage.getItem(VERSION_KEY); } catch(e){}
        if (seen && seen !== data.v){
          try { window.localStorage.setItem(VERSION_KEY, data.v); } catch(e){}
          window.location.replace(window.location.pathname + "?_=" + Date.now());
          return;
        }
        if (!seen){
          try { window.localStorage.setItem(VERSION_KEY, data.v); } catch(e){}
        }
      })
      .catch(function(){ /* offline, or fetch blocked — just keep whatever is already loaded */ });
  }
  checkVersion();
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState === "visible") checkVersion();
  });
  window.addEventListener("pageshow", function(){ checkVersion(); });
})();

(function(){
  "use strict";

  var STORAGE_KEY = "fieldNotesState";

  // ---------- Cloud sync (Firebase) ----------
  var firebaseConfig = {
    apiKey: "AIzaSyCI1JUVG26uRTqhDAx1pXIzmGPp9sRoRS4",
    authDomain: "bible-study-8c876.firebaseapp.com",
    projectId: "bible-study-8c876",
    storageBucket: "bible-study-8c876.firebasestorage.app",
    messagingSenderId: "355160807110",
    appId: "1:355160807110:web:fa8f384ee25917423629c7",
    measurementId: "G-2H3YNQ8ZJZ"
  };
  var fbAuth = null, fbDb = null, cloudAvailable = false;
  var cloudUser = null;          // signed-in Firebase user, or null
  var cloudLoaded = false;       // true once we've pulled the cloud copy at least once this session
  var suppressCloudSave = false; // true while we're applying a cloud snapshot, so we don't immediately re-save it
  var cloudSaveTimer = null;
  var unsubscribeCloudSnapshot = null;
  try {
    if (window.firebase){
      firebase.initializeApp(firebaseConfig);
      fbAuth = firebase.auth();
      fbDb = firebase.firestore();
      cloudAvailable = true;
    }
  } catch(e){ cloudAvailable = false; }

  var DEFAULT_BOOKS = [
    {name:"Genesis", chapters:50},
    {name:"Exodus", chapters:40},
    {name:"Mark", chapters:16},
    {name:"Acts", chapters:28}
  ];

  // Full canonical list with chapter counts, used to populate "add a book" and to build plans.
  var BOOK_CHAPTERS = [
    ["Genesis",50],["Exodus",40],["Leviticus",27],["Numbers",36],["Deuteronomy",34],
    ["Joshua",24],["Judges",21],["Ruth",4],["1 Samuel",31],["2 Samuel",24],
    ["1 Kings",22],["2 Kings",25],["1 Chronicles",29],["2 Chronicles",36],["Ezra",10],
    ["Nehemiah",13],["Esther",10],["Job",42],["Psalms",150],["Proverbs",31],
    ["Ecclesiastes",12],["Song of Solomon",8],["Isaiah",66],["Jeremiah",52],["Lamentations",5],
    ["Ezekiel",48],["Daniel",12],["Hosea",14],["Joel",3],["Amos",9],
    ["Obadiah",1],["Jonah",4],["Micah",7],["Nahum",3],["Habakkuk",3],
    ["Zephaniah",3],["Haggai",2],["Zechariah",14],["Malachi",4],
    ["Matthew",28],["Mark",16],["Luke",24],["John",21],["Acts",28],
    ["Romans",16],["1 Corinthians",16],["2 Corinthians",13],["Galatians",6],["Ephesians",6],
    ["Philippians",4],["Colossians",4],["1 Thessalonians",5],["2 Thessalonians",3],["1 Timothy",6],
    ["2 Timothy",4],["Titus",3],["Philemon",1],["Hebrews",13],["James",5],
    ["1 Peter",5],["2 Peter",3],["1 John",5],["2 John",1],["3 John",1],
    ["Jude",1],["Revelation",22]
  ];
  function chaptersFor(name){
    for (var i=0;i<BOOK_CHAPTERS.length;i++){ if (BOOK_CHAPTERS[i][0]===name) return BOOK_CHAPTERS[i][1]; }
    return 1;
  }

  // Curated, self-paced reading plans — no dates, just an ordered stack of books.
  var PLANS = [
    {
      name:"Foundations",
      desc:"A first pass through the shape of the whole story: origins, deliverance, a fast Gospel, the church's start.",
      books:["Genesis","Exodus","Mark","Acts"]
    },
    {
      name:"Torah",
      desc:"The five books of the Law — Israel's origins, the exodus, and the covenant given at Sinai.",
      books:["Genesis","Exodus","Leviticus","Numbers","Deuteronomy"]
    },
    {
      name:"Israel's Story",
      desc:"From patriarchs to kingdom: how the nation forms and takes the land.",
      books:["Genesis","Exodus","Joshua","Judges","Ruth","1 Samuel","2 Samuel"]
    },
    {
      name:"The Gospels",
      desc:"Four accounts of the same story, each with its own angle — read side by side for the differences.",
      books:["Matthew","Mark","Luke","John"]
    },
    {
      name:"The Early Church",
      desc:"How the church spreads from Jerusalem outward, and Paul's first letters back to it.",
      books:["Acts","Romans","1 Corinthians","Galatians"]
    },
    {
      name:"Paul's Letters",
      desc:"The full run of Paul's letters to churches — doctrine, correction, and encouragement.",
      books:["Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians"]
    },
    {
      name:"Wisdom Books",
      desc:"Suffering, worship, proverbs and the search for meaning — the Old Testament's reflective core.",
      books:["Job","Psalms","Proverbs","Ecclesiastes"]
    }
  ];

  var EXAMPLE_KEY = "Genesis-1";
  var EXAMPLE_ENTRY = {
    sections:[
      {id:"s1", title:"vv. 1–2", summary:"", observations:"", interpretation:"", application:"", promises:"", commands:"", question:""},
      {id:"s2", title:"vv. 3–13", summary:"", observations:"", interpretation:"", application:"", promises:"", commands:"", question:""},
      {id:"s3", title:"vv. 14–31", summary:"", observations:"", interpretation:"", application:"", promises:"", commands:"", question:""}
    ]
  };

  // Older saves used shapes this app no longer has: flat chapter-level fields (before
  // sections existed), a separate per-section Geography field, and chapter-level
  // Summary/Question (before they moved into each section). Fold all of that forward
  // so nothing already written gets lost.
  function migrateEntry(e){
    if (!e) return e;
    if (!e.sections) e.sections = [];
    var hasFlat = e.history || e.geography || e.promises || e.commands;
    if (hasFlat){
      var obs = e.history || "";
      if (e.geography) obs = obs ? obs + "\nGeography: " + e.geography : "Geography: " + e.geography;
      e.sections.unshift({
        id: "m" + Date.now() + Math.random().toString(36).slice(2,6),
        title: "", summary:"", observations: obs, promises: e.promises || "", commands: e.commands || "", question: ""
      });
      delete e.history; delete e.geography; delete e.promises; delete e.commands;
    }
    e.sections.forEach(function(s){
      if (s.geography){
        s.observations = (s.observations ? s.observations + "\n" : "") + "Geography: " + s.geography;
        delete s.geography;
      }
      if (s.summary === undefined) s.summary = "";
      if (s.interpretation === undefined) s.interpretation = "";
      if (s.application === undefined) s.application = "";
      if (s.question === undefined) s.question = "";
    });
    if (e.summary || e.question){
      if (!e.sections.length){
        e.sections.push({id:"m"+Date.now()+Math.random().toString(36).slice(2,6), title:"", summary:e.summary||"", observations:"", promises:"", commands:"", question:e.question||""});
      } else {
        if (e.summary && !e.sections[0].summary) e.sections[0].summary = e.summary;
        if (e.question && !e.sections[0].question) e.sections[0].question = e.question;
      }
      delete e.summary; delete e.question;
    }
    return e;
  }

  function loadState(){
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.books && parsed.books.length) return parsed;
      }
    } catch(e){ /* storage unavailable or corrupt — fall through to defaults */ }
    var fresh = {
      books: DEFAULT_BOOKS,
      entries: {},
      current: {book:"Genesis", chapter:1}
    };
    fresh.entries[EXAMPLE_KEY] = EXAMPLE_ENTRY;
    return fresh;
  }

  var state = loadState();
  if (!state.current) state.current = {book: state.books[0].name, chapter:1};
  Object.keys(state.entries).forEach(function(k){ state.entries[k] = migrateEntry(state.entries[k]); });

  // ---------- Viewing someone else's notes (read-only) ----------
  // viewingUid is null while looking at your own notes (the normal, editable case).
  // When set, ctx() points at otherData (a one-time fetch of that person's notebook)
  // instead of your own state, and the Study tab switches to a read-only display.
  var viewingUid = null;
  var otherData = null;
  var membersMap = {};
  var unsubscribeMembers = null;
  function ctx(){ return (viewingUid && otherData) ? otherData : state; }
  function isEditable(){ return !viewingUid; }

  function key(book, ch){ return book + "-" + ch; }
  function findBook(name){
    var c = ctx();
    for (var i=0;i<c.books.length;i++){ if (c.books[i].name===name) return c.books[i]; }
    return c.books[0];
  }
  function esc(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  var statusEl = document.getElementById("saveStatus");
  function persist(msg){
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      statusEl.textContent = msg || "Saved";
    } catch(e){
      statusEl.textContent = "Couldn't save to this browser — try again";
    }
    setTimeout(function(){ statusEl.textContent = ""; }, 2200);
    if (!suppressCloudSave) scheduleCloudSave();
  }

  // ---------- Cloud sync wiring ----------
  var syncBar = document.getElementById("syncBar");
  var signInBtn = document.getElementById("signInBtn");

  function cloudDocRef(uid){ return fbDb.collection("notebooks").doc(uid); }

  function setSyncUI(mode){
    // modes: "signed-out", "loading", "synced", "saving", "error"
    if (!cloudAvailable){
      syncBar.innerHTML = '<span style="font-size:12px;color:var(--ink-soft)">Notes are saved in this browser only.</span>';
      return;
    }
    if (mode === "signed-out"){
      syncBar.innerHTML = '<button type="button" class="sync-btn" id="signInBtn">Sign in with Google to sync your notes</button>';
      document.getElementById("signInBtn").addEventListener("click", doSignIn);
      return;
    }
    var dotClass = mode === "synced" ? "on" : (mode === "error" ? "" : "busy");
    var label = mode === "loading" ? "Loading your notes…" :
                mode === "saving" ? "Saving…" :
                mode === "error" ? "Couldn't reach the cloud — saved to this browser only" :
                ("Synced as " + (cloudUser && (cloudUser.email || cloudUser.displayName) || "you"));
    syncBar.innerHTML =
      '<span class="sync-dot '+dotClass+'"></span>' +
      '<span>'+esc(label)+'</span>' +
      '<button type="button" class="sync-out" id="signOutBtn">Sign out</button>';
    document.getElementById("signOutBtn").addEventListener("click", doSignOut);
  }

  function showSyncError(err){
    var msg = (err && (err.code || err.message)) || "Something went wrong signing in";
    syncBar.innerHTML =
      '<span class="sync-dot"></span>' +
      '<span style="color:var(--command)">'+esc(msg)+'</span>' +
      '<button type="button" class="sync-btn" id="signInBtn">Try again</button>';
    document.getElementById("signInBtn").addEventListener("click", doSignIn);
  }

  function doSignIn(){
    if (!cloudAvailable) return;
    var provider = new firebase.auth.GoogleAuthProvider();
    // Popup-based sign-in: everything happens on this one page, so there's no
    // cross-page marker for Safari to lose track of (which is what was breaking
    // the previous full-page-redirect approach). Fall back to redirect only if
    // the browser genuinely can't do a popup here.
    setSyncUI("loading");
    try {
      fbAuth.signInWithPopup(provider).catch(function(err){
        var code = err && err.code;
        if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment" || code === "auth/cancelled-popup-request"){
          fbAuth.signInWithRedirect(provider).catch(showSyncError);
        } else if (code === "auth/popup-closed-by-user"){
          setSyncUI("signed-out");
        } else {
          showSyncError(err);
        }
      });
    } catch(err){
      showSyncError(err);
    }
  }
  function doSignOut(){
    if (!cloudAvailable) return;
    fbAuth.signOut();
  }

  function scheduleCloudSave(){
    if (!cloudAvailable || !cloudUser) return;
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(function(){
      setSyncUI("saving");
      cloudDocRef(cloudUser.uid).set({
        books: state.books,
        entries: state.entries,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function(){
        setSyncUI("synced");
      }).catch(function(){
        setSyncUI("error");
      });
    }, 800);
  }

  function applyCloudSnapshot(data){
    suppressCloudSave = true;
    if (data && data.books && data.books.length){
      state.books = data.books;
      state.entries = data.entries || {};
      Object.keys(state.entries).forEach(function(k){ state.entries[k] = migrateEntry(state.entries[k]); });
      if (!findBookExists(state.current.book)) state.current = {book: state.books[0].name, chapter:1};
    }
    renderBookSelect();
    renderChapterGrid();
    renderEntry();
    suppressCloudSave = false;
  }
  function findBookExists(name){
    return state.books.some(function(b){ return b.name === name; });
  }

  // ---------- Members directory (so you can find each other to compare notes) ----------
  function publishMembership(user){
    fbDb.collection("members").doc(user.uid).set({
      name: user.displayName || (user.email ? user.email.split("@")[0] : "Someone"),
      email: user.email || "",
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, {merge:true}).catch(function(){ /* non-essential — ignore */ });
  }
  function subscribeMembers(){
    if (unsubscribeMembers){ unsubscribeMembers(); unsubscribeMembers = null; }
    unsubscribeMembers = fbDb.collection("members").onSnapshot(function(snap){
      membersMap = {};
      snap.forEach(function(doc){ membersMap[doc.id] = doc.data(); });
      renderViewingSelect();
    }, function(){ /* ignore — comparing notes is optional, your own notes still work */ });
  }
  function stopViewingOther(){
    viewingUid = null;
    otherData = null;
  }

  function initCloudSync(){
    if (!cloudAvailable){
      setSyncUI("signed-out");
      return;
    }
    signInBtn.addEventListener("click", doSignIn);
    // Surface any error from a just-completed redirect sign-in (e.g. the user cancelled).
    // A successful sign-in is picked up by onAuthStateChanged below, not here.
    fbAuth.getRedirectResult().catch(showSyncError);
    fbAuth.onAuthStateChanged(function(user){
      cloudUser = user;
      if (unsubscribeCloudSnapshot){ unsubscribeCloudSnapshot(); unsubscribeCloudSnapshot = null; }
      if (!user){
        cloudLoaded = false;
        setSyncUI("signed-out");
        if (unsubscribeMembers){ unsubscribeMembers(); unsubscribeMembers = null; }
        membersMap = {};
        stopViewingOther();
        renderViewingSelect();
        renderBookSelect(); renderChapterGrid(); renderEntry();
        return;
      }
      setSyncUI("loading");
      publishMembership(user);
      subscribeMembers();
      var ref = cloudDocRef(user.uid);
      ref.get().then(function(doc){
        if (doc.exists){
          applyCloudSnapshot(doc.data());
          setSyncUI("synced");
        } else {
          // First time signing in on this account — push whatever is saved locally up as the starting point.
          ref.set({
            books: state.books,
            entries: state.entries,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          }).then(function(){ setSyncUI("synced"); }).catch(function(){ setSyncUI("error"); });
        }
        cloudLoaded = true;
        // Stay in sync with changes made from another device.
        unsubscribeCloudSnapshot = ref.onSnapshot(function(snap){
          if (!cloudLoaded || !snap.exists) return;
          applyCloudSnapshot(snap.data());
        });
      }).catch(function(){
        setSyncUI("error");
      });
    });
  }

  // ---------- Tabs ----------
  var tabs = {
    study: document.getElementById("tab-study"),
    findings: document.getElementById("tab-findings"),
    method: document.getElementById("tab-method")
  };
  var views = {
    study: document.getElementById("view-study"),
    findings: document.getElementById("view-findings"),
    method: document.getElementById("view-method")
  };
  function selectTab(name){
    Object.keys(tabs).forEach(function(k){
      tabs[k].setAttribute("aria-selected", k===name ? "true":"false");
      views[k].hidden = k!==name;
    });
    if (name==="findings") renderFindings();
  }
  tabs.study.addEventListener("click", function(){ selectTab("study"); });
  tabs.findings.addEventListener("click", function(){ selectTab("findings"); });
  tabs.method.addEventListener("click", function(){ selectTab("method"); });

  // ---------- Rail: book select + chapter grid ----------
  var bookSelect = document.getElementById("bookSelect");
  var chapterGrid = document.getElementById("chapterGrid");
  var progressLabel = document.getElementById("progressLabel");
  var progressFill = document.getElementById("progressFill");
  var addBookBtn = document.getElementById("addBookBtn");
  var addBookForm = document.getElementById("addBookForm");
  var newBookSelect = document.getElementById("newBookSelect");
  var confirmAddBook = document.getElementById("confirmAddBook");
  var cancelAddBook = document.getElementById("cancelAddBook");
  var addBookNote = document.getElementById("addBookNote");
  var browsePlansBtn = document.getElementById("browsePlansBtn");
  var plansModal = document.getElementById("plansModal");
  var plansList = document.getElementById("plansList");
  var closePlansModal = document.getElementById("closePlansModal");
  var railActions = document.getElementById("railActions");
  var viewingRow = document.getElementById("viewingRow");
  var viewingSelect = document.getElementById("viewingSelect");
  var readonlyBanner = document.getElementById("readonlyBanner");
  var readonlyName = document.getElementById("readonlyName");

  function renderBookSelect(){
    var c = ctx();
    bookSelect.innerHTML = c.books.map(function(b){
      return '<option value="'+esc(b.name)+'"'+(b.name===c.current.book?" selected":"")+'>'+esc(b.name)+'</option>';
    }).join("");
  }

  function hasSections(e){
    return e && e.sections && e.sections.some(function(s){
      return s.title||s.summary||s.observations||s.interpretation||s.application||s.promises||s.commands||s.question;
    });
  }
  function countDone(book){
    var n = 0, c = ctx();
    for (var ch=1;ch<=book.chapters;ch++){
      var e = c.entries[key(book.name,ch)];
      if (hasSections(e)) n++;
    }
    return n;
  }

  function renderChapterGrid(){
    var c = ctx();
    var book = findBook(c.current.book);
    var done = countDone(book);
    progressLabel.textContent = done + " / " + book.chapters;
    progressFill.style.width = (book.chapters? (done/book.chapters*100):0) + "%";
    var html = "";
    for (var ch=1;ch<=book.chapters;ch++){
      var e = c.entries[key(book.name,ch)];
      var filled = hasSections(e);
      html += '<button type="button" data-ch="'+ch+'" class="'+(filled?"done":"")+'"'+
        (ch===c.current.chapter?' aria-current="true"':'')+
        ' aria-label="'+esc(book.name)+' '+ch+(filled?", has notes":", no notes yet")+'">'+ch+'</button>';
    }
    chapterGrid.innerHTML = html;
    Array.prototype.forEach.call(chapterGrid.querySelectorAll("button"), function(btn){
      btn.addEventListener("click", function(){
        flushAutoSave();
        ctx().current.chapter = parseInt(btn.getAttribute("data-ch"),10);
        renderChapterGrid();
        renderEntry();
      });
    });
  }

  bookSelect.addEventListener("change", function(){
    flushAutoSave();
    var c = ctx();
    c.current.book = bookSelect.value;
    c.current.chapter = 1;
    renderChapterGrid();
    renderEntry();
  });

  function remainingBooks(){
    return BOOK_CHAPTERS.filter(function(b){
      return !state.books.some(function(existing){ return existing.name.toLowerCase()===b[0].toLowerCase(); });
    });
  }

  function openAddBookForm(){
    var remaining = remainingBooks();
    addBookNote.hidden = true;
    if (!remaining.length){
      newBookSelect.innerHTML = "";
      addBookNote.textContent = "Every book is already in your plan.";
      addBookNote.hidden = false;
      confirmAddBook.disabled = true;
    } else {
      confirmAddBook.disabled = false;
      newBookSelect.innerHTML = remaining.map(function(b){
        return '<option value="'+esc(b[0])+'">'+esc(b[0])+' ('+b[1]+' ch.)</option>';
      }).join("");
    }
    addBookForm.hidden = false;
    addBookBtn.hidden = true;
  }
  function closeAddBookForm(){
    addBookForm.hidden = true;
    addBookBtn.hidden = false;
  }

  addBookBtn.addEventListener("click", openAddBookForm);
  cancelAddBook.addEventListener("click", closeAddBookForm);

  confirmAddBook.addEventListener("click", function(){
    var name = newBookSelect.value;
    if (!name) return;
    state.books.push({name:name, chapters:chaptersFor(name)});
    renderBookSelect();
    renderChapterGrid();
    closeAddBookForm();
    persist("Added " + name + " to your plan — pick it from the Book list above when you're ready");
  });

  // ---------- Reading plans ----------
  function renderPlans(){
    plansList.innerHTML = PLANS.map(function(plan, idx){
      var have = plan.books.filter(function(n){ return state.books.some(function(b){ return b.name.toLowerCase()===n.toLowerCase(); }); });
      var allIn = have.length === plan.books.length;
      return '<div class="plan-card">'+
        '<h3>'+esc(plan.name)+'</h3>'+
        '<p>'+esc(plan.desc)+'</p>'+
        '<p class="plan-books">'+esc(plan.books.join(" · "))+'</p>'+
        '<button type="button" class="plan-add" data-plan="'+idx+'"'+(allIn?' disabled':'')+'>'+
          (allIn ? "Already in your plan" : "Add to my plan")+
        '</button>'+
      '</div>';
    }).join("");
    Array.prototype.forEach.call(plansList.querySelectorAll(".plan-add"), function(btn){
      btn.addEventListener("click", function(){
        var plan = PLANS[parseInt(btn.getAttribute("data-plan"),10)];
        var added = 0;
        plan.books.forEach(function(name){
          var exists = state.books.some(function(b){ return b.name.toLowerCase()===name.toLowerCase(); });
          if (!exists) { state.books.push({name:name, chapters:chaptersFor(name)}); added++; }
        });
        renderBookSelect();
        renderChapterGrid();
        renderPlans();
        plansModal.hidden = true;
        persist("Added " + plan.name + " (" + added + " book" + (added===1?"":"s") + ") — still viewing " + findBook(state.current.book).name);
      });
    });
  }
  browsePlansBtn.addEventListener("click", function(){
    renderPlans();
    plansModal.hidden = false;
  });
  closePlansModal.addEventListener("click", function(){ plansModal.hidden = true; });
  plansModal.addEventListener("click", function(ev){
    if (ev.target === plansModal) plansModal.hidden = true;
  });

  // ---------- Entry form ----------
  var entryTitle = document.getElementById("entryTitle");
  var exampleFlag = document.getElementById("exampleFlag");
  var prevBtn = document.getElementById("prevChapter");
  var nextBtn = document.getElementById("nextChapter");
  var form = document.getElementById("entryForm");
  var clearBtn = document.getElementById("clearBtn");
  var sectionsList = document.getElementById("sectionsList");
  var addSectionBtn = document.getElementById("addSectionBtn");

  var clearArmed = false;
  var clearArmedTimer = null;

  function newSectionId(){ return "s" + Date.now() + Math.random().toString(36).slice(2,6); }

  function sectionRowHtml(s, num){
    return '<div class="section-row" data-id="'+esc(s.id)+'">'+
      '<div class="section-row-head">'+
        '<span class="section-num">'+num+'</span>'+
        '<input type="text" class="section-title" data-role="title" placeholder="Section title — e.g. vv. 1–10" value="'+esc(s.title||"")+'">'+
        '<button type="button" class="section-remove" data-role="remove" aria-label="Remove section">✕</button>'+
      '</div>'+
      '<div class="mini-field summary">'+
        '<label><span class="tag">Summary</span>One sentence, in your own words</label>'+
        '<input type="text" data-role="summary" placeholder="e.g. God speaks this part of the world into being" value="'+esc(s.summary||"")+'">'+
      '</div>'+
      '<div class="mini-field observations">'+
        '<label><span class="tag">Observations</span>Who, what happened, when, what led here? (Places named too.)</label>'+
        '<textarea rows="2" data-role="observations" placeholder="What do you notice in this part?">'+esc(s.observations||"")+'</textarea>'+
      '</div>'+
      '<div class="mini-field interpretation">'+
        '<label><span class="tag">Interpretation</span>What does it mean?</label>'+
        '<textarea rows="2" data-role="interpretation" placeholder="What is this part actually saying, and why?">'+esc(s.interpretation||"")+'</textarea>'+
      '</div>'+
      '<div class="mini-field application">'+
        '<label><span class="tag">Application</span>What will you do about it?</label>'+
        '<textarea rows="2" data-role="application" placeholder="How does this change what you think or do?">'+esc(s.application||"")+'</textarea>'+
      '</div>'+
      '<div class="mini-row2">'+
        '<div class="mini-field promises">'+
          '<label><span class="tag">Promises</span>What God says He will do</label>'+
          '<textarea rows="2" data-role="promises" placeholder="e.g. none stated yet">'+esc(s.promises||"")+'</textarea>'+
        '</div>'+
        '<div class="mini-field commands">'+
          '<label><span class="tag">Commands</span>What we\'re told to do</label>'+
          '<textarea rows="2" data-role="commands" placeholder="e.g. be fruitful and multiply">'+esc(s.commands||"")+'</textarea>'+
        '</div>'+
      '</div>'+
      '<div class="mini-field question">'+
        '<label><span class="tag">Question</span>Something you couldn\'t answer yet</label>'+
        '<input type="text" data-role="question" placeholder="e.g. Why six days specifically?" value="'+esc(s.question||"")+'">'+
      '</div>'+
    '</div>';
  }

  function wireSectionRemove(btn){
    btn.addEventListener("click", function(){
      if (!isEditable()) return;
      btn.closest(".section-row").remove();
      renumberSections();
      if (!sectionsList.querySelector(".section-row")){
        sectionsList.innerHTML = '<p class="sections-empty">No sections yet — add one below, starting from the top of the chapter.</p>';
      }
      clearTimeout(autoSaveTimer);
      saveEntry("Saved automatically");
    });
  }

  function renumberSections(){
    Array.prototype.forEach.call(sectionsList.querySelectorAll(".section-row"), function(row, i){
      row.querySelector(".section-num").textContent = i+1;
    });
  }

  function sectionReadOnlyHtml(s, num){
    var rows = [
      ["Summary", s.summary],
      ["Observations", s.observations],
      ["Interpretation", s.interpretation],
      ["Application", s.application],
      ["Promises", s.promises],
      ["Commands", s.commands],
      ["Question", s.question]
    ].filter(function(pair){ return pair[1]; }).map(function(pair){
      return '<div class="ro-row"><span class="tag">'+esc(pair[0])+'</span>'+esc(pair[1])+'</div>';
    }).join("");
    return '<div class="section-row readonly">'+
      '<div class="section-row-head"><span class="section-num">'+num+'</span>'+
        '<span class="section-title-ro">'+esc(s.title||"(untitled section)")+'</span></div>'+
      (rows || '<p class="sections-empty">Nothing logged in this section yet.</p>') +
    '</div>';
  }

  function renderSections(sections, editable){
    if (!sections || !sections.length){
      sectionsList.innerHTML = '<p class="sections-empty">'+(editable ? "No sections yet — add one below, starting from the top of the chapter." : "No sections logged yet.")+'</p>';
      return;
    }
    if (editable){
      sectionsList.innerHTML = sections.map(function(s,i){ return sectionRowHtml(s, i+1); }).join("");
      Array.prototype.forEach.call(sectionsList.querySelectorAll('[data-role="remove"]'), wireSectionRemove);
    } else {
      sectionsList.innerHTML = sections.map(function(s,i){ return sectionReadOnlyHtml(s, i+1); }).join("");
    }
  }

  function readSectionsFromDom(){
    var rows = sectionsList.querySelectorAll(".section-row");
    var out = [];
    Array.prototype.forEach.call(rows, function(row){
      var title = row.querySelector('[data-role="title"]').value.trim();
      var summary = row.querySelector('[data-role="summary"]').value.trim();
      var observations = row.querySelector('[data-role="observations"]').value.trim();
      var interpretation = row.querySelector('[data-role="interpretation"]').value.trim();
      var application = row.querySelector('[data-role="application"]').value.trim();
      var promises = row.querySelector('[data-role="promises"]').value.trim();
      var commands = row.querySelector('[data-role="commands"]').value.trim();
      var question = row.querySelector('[data-role="question"]').value.trim();
      if (title || summary || observations || interpretation || application || promises || commands || question){
        out.push({
          id: row.getAttribute("data-id") || newSectionId(),
          title:title, summary:summary, observations:observations, interpretation:interpretation, application:application, promises:promises, commands:commands, question:question
        });
      }
    });
    return out;
  }

  addSectionBtn.addEventListener("click", function(){
    if (!isEditable()) return;
    var placeholder = sectionsList.querySelector(".sections-empty");
    if (placeholder) sectionsList.innerHTML = "";
    var num = sectionsList.querySelectorAll(".section-row").length + 1;
    sectionsList.insertAdjacentHTML("beforeend", sectionRowHtml({id:newSectionId(), title:"", summary:"", observations:"", interpretation:"", application:"", promises:"", commands:"", question:""}, num));
    var rows = sectionsList.querySelectorAll(".section-row");
    var last = rows[rows.length-1];
    wireSectionRemove(last.querySelector('[data-role="remove"]'));
    last.querySelector('[data-role="title"]').focus();
  });

  // ---------- Autosave ----------
  // Writing is saved as you go (debounced ~1s after you stop typing), so nothing is
  // lost if you navigate away or close the app without tapping Save. The Save button
  // still works for an immediate, explicit save.
  var autoSaveTimer = null;

  function saveEntry(statusMsg){
    if (!isEditable()) return;
    var book = findBook(state.current.book);
    var k = key(book.name, state.current.chapter);
    state.entries[k] = {
      sections: readSectionsFromDom()
    };
    exampleFlag.hidden = true;
    renderChapterGrid();
    persist(statusMsg);
  }

  function scheduleAutoSave(){
    if (!isEditable()) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(function(){
      autoSaveTimer = null;
      saveEntry("Saved automatically");
    }, 900);
  }

  function flushAutoSave(){
    if (autoSaveTimer){
      clearTimeout(autoSaveTimer);
      autoSaveTimer = null;
      saveEntry("Saved automatically");
    }
  }

  sectionsList.addEventListener("input", function(){
    if (!isEditable()) return;
    scheduleAutoSave();
  });

  // Catch-alls so a pending autosave never gets lost: flush right before the page
  // might go away, and periodically while the tab is hidden (phone locked, app
  // switched away from) since a setTimeout can be paused in the background.
  window.addEventListener("pagehide", flushAutoSave);
  window.addEventListener("beforeunload", flushAutoSave);
  document.addEventListener("visibilitychange", function(){
    if (document.visibilityState === "hidden") flushAutoSave();
  });

  function applyViewMode(){
    var editable = isEditable();
    addSectionBtn.hidden = !editable;
    form.querySelector(".actions").hidden = !editable;
    railActions.hidden = !editable;
    if (!editable) addBookForm.hidden = true;
    readonlyBanner.hidden = editable;
    if (!editable){
      var m = membersMap[viewingUid];
      readonlyName.textContent = (m && m.name) || "their";
    }
  }

  function renderEntry(){
    var c = ctx();
    var editable = isEditable();
    var book = findBook(c.current.book);
    var k = key(book.name, c.current.chapter);
    var e = c.entries[k] || {};
    entryTitle.textContent = book.name + " " + c.current.chapter;
    exampleFlag.hidden = !(editable && k === EXAMPLE_KEY);
    renderSections(e.sections, editable);
    prevBtn.disabled = c.current.chapter<=1;
    nextBtn.disabled = c.current.chapter>=book.chapters;
    if (clearArmed){
      clearTimeout(clearArmedTimer);
      clearArmed = false;
      clearBtn.textContent = "Clear this chapter";
      clearBtn.classList.remove("confirming");
    }
    applyViewMode();
  }

  prevBtn.addEventListener("click", function(){
    flushAutoSave();
    var c = ctx();
    if (c.current.chapter>1){ c.current.chapter--; renderChapterGrid(); renderEntry(); }
  });
  nextBtn.addEventListener("click", function(){
    flushAutoSave();
    var c = ctx();
    var book = findBook(c.current.book);
    if (c.current.chapter<book.chapters){ c.current.chapter++; renderChapterGrid(); renderEntry(); }
  });

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    saveEntry("Saved");
  });

  clearBtn.addEventListener("click", function(){
    if (!isEditable()) return;
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
    var book = findBook(state.current.book);
    var k = key(book.name, state.current.chapter);
    if (!state.entries[k]) return;
    if (!clearArmed){
      clearArmed = true;
      clearBtn.textContent = "Click again to confirm";
      clearBtn.classList.add("confirming");
      clearArmedTimer = setTimeout(function(){
        clearArmed = false;
        clearBtn.textContent = "Clear this chapter";
        clearBtn.classList.remove("confirming");
      }, 3000);
      return;
    }
    clearTimeout(clearArmedTimer);
    clearArmed = false;
    clearBtn.textContent = "Clear this chapter";
    clearBtn.classList.remove("confirming");
    delete state.entries[k];
    renderEntry();
    renderChapterGrid();
    persist("Cleared " + book.name + " " + state.current.chapter);
  });

  // ---------- Findings ----------
  function renderFindings(){
    var historyItems = [], promiseItems = [], commandItems = [];
    var ctxData = ctx();
    ctxData.books.forEach(function(book){
      for (var c=1;c<=book.chapters;c++){
        var e = ctxData.entries[key(book.name,c)];
        if (!e) continue;
        var ref = book.name + " " + c;
        if (e.sections && e.sections.length){
          e.sections.forEach(function(s){
            var sref = ref + (s.title? " — "+s.title : "");
            if (s.summary) historyItems.push({ref:sref, text:s.summary});
            if (s.observations) historyItems.push({ref:sref, text:s.observations});
            if (s.interpretation) historyItems.push({ref:sref, text:s.interpretation});
            if (s.promises && !/^none\b/i.test(s.promises.trim())) promiseItems.push({ref:sref, text:s.promises});
            if (s.commands && !/^none\b/i.test(s.commands.trim())) commandItems.push({ref:sref, text:s.commands});
          });
        }
      }
    });

    function fill(id, items, emptyMsg){
      var el = document.getElementById(id);
      if (!items.length){ el.innerHTML = '<p class="findings-empty">'+esc(emptyMsg)+'</p>'; return; }
      el.innerHTML = '<ul class="findings-list">' + items.map(function(it){
        return '<li>'+esc(it.text)+'<span class="findings-ref">'+esc(it.ref)+'</span></li>';
      }).join("") + '</ul>';
    }
    fill("list-history", historyItems, "Nothing logged yet — save a section's summary or observations to start your timeline.");
    fill("list-promises", promiseItems, "No promises logged yet.");
    fill("list-commands", commandItems, "No commands logged yet.");
  }

  // ---------- Viewing someone else ----------
  function renderViewingSelect(){
    if (!cloudUser){ viewingRow.hidden = true; return; }
    var others = Object.keys(membersMap).filter(function(uid){ return uid !== cloudUser.uid; });
    if (!others.length){ viewingRow.hidden = true; return; }
    viewingRow.hidden = false;
    viewingSelect.innerHTML = '<option value="">Me</option>' + others.map(function(uid){
      var m = membersMap[uid];
      return '<option value="'+esc(uid)+'"'+(uid===viewingUid?" selected":"")+'>'+esc((m && m.name) || "Someone")+'</option>';
    }).join("");
  }

  viewingSelect.addEventListener("change", function(){
    flushAutoSave();
    var uid = viewingSelect.value;
    if (!uid){
      stopViewingOther();
      renderBookSelect(); renderChapterGrid(); renderEntry();
      if (!views.findings.hidden) renderFindings();
      return;
    }
    viewingUid = uid;
    sectionsList.innerHTML = '<p class="sections-empty">Loading…</p>';
    fbDb.collection("notebooks").doc(uid).get().then(function(doc){
      var data = doc.exists ? doc.data() : null;
      if (data && data.books && data.books.length){
        var entries = data.entries || {};
        Object.keys(entries).forEach(function(k){ entries[k] = migrateEntry(entries[k]); });
        otherData = {books: data.books, entries: entries, current: {book: data.books[0].name, chapter:1}};
      } else {
        otherData = {books: DEFAULT_BOOKS, entries: {}, current: {book: DEFAULT_BOOKS[0].name, chapter:1}};
      }
      renderBookSelect(); renderChapterGrid(); renderEntry();
      if (!views.findings.hidden) renderFindings();
    }).catch(function(){
      sectionsList.innerHTML = '<p class="sections-empty">Couldn\'t load their notes right now — try again in a moment.</p>';
    });
  });

  // ---------- Boot ----------
  renderBookSelect();
  renderChapterGrid();
  renderEntry();
  initCloudSync();
})();
