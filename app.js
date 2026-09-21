(function(){
  "use strict";

  var STORAGE_KEY = "fieldNotesState";

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
    history:"God creates the heavens and earth over six days: light, sky, land and seas, sun/moon/stars, sea and air creatures, land animals and mankind. He rests on the seventh day.",
    geography:"",
    promises:"none stated yet in this chapter",
    commands:"be fruitful and multiply, fill the earth, subdue it, rule over the creatures (to mankind)",
    summary:"God speaks the world into ordered existence, piece by piece, and calls it good.",
    question:"Why six days specifically, and why does day seven matter enough to be its own thing?",
    sections:[
      {id:"s1", title:"vv. 1–2 — before", text:"Formless, empty, dark — nothing shaped or filled yet. The Spirit is already there, hovering."},
      {id:"s2", title:"vv. 3–13 — days 1–3 (forming)", text:"Light/dark, sky/sea, land/plants. God separates and names things."},
      {id:"s3", title:"vv. 14–31 — days 4–6 (filling)", text:"Sun/moon/stars fill the light and dark; birds/fish fill sky and sea; animals and people fill the land. Each 'filling' day matches a 'forming' day from before."}
    ]
  };

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

  function key(book, ch){ return book + "-" + ch; }
  function findBook(name){
    for (var i=0;i<state.books.length;i++){ if (state.books[i].name===name) return state.books[i]; }
    return state.books[0];
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

  function renderBookSelect(){
    bookSelect.innerHTML = state.books.map(function(b){
      return '<option value="'+esc(b.name)+'"'+(b.name===state.current.book?" selected":"")+'>'+esc(b.name)+'</option>';
    }).join("");
  }

  function hasSections(e){
    return e && e.sections && e.sections.some(function(s){ return (s.title||s.text); });
  }
  function countDone(book){
    var n = 0;
    for (var c=1;c<=book.chapters;c++){
      var e = state.entries[key(book.name,c)];
      if (e && (e.history||e.geography||e.promises||e.commands||e.summary||hasSections(e))) n++;
    }
    return n;
  }

  function renderChapterGrid(){
    var book = findBook(state.current.book);
    var done = countDone(book);
    progressLabel.textContent = done + " / " + book.chapters;
    progressFill.style.width = (book.chapters? (done/book.chapters*100):0) + "%";
    var html = "";
    for (var c=1;c<=book.chapters;c++){
      var e = state.entries[key(book.name,c)];
      var filled = e && (e.history||e.geography||e.promises||e.commands||e.summary||hasSections(e));
      html += '<button type="button" data-ch="'+c+'" class="'+(filled?"done":"")+'"'+
        (c===state.current.chapter?' aria-current="true"':'')+
        ' aria-label="'+esc(book.name)+' '+c+(filled?", has notes":", no notes yet")+'">'+c+'</button>';
    }
    chapterGrid.innerHTML = html;
    Array.prototype.forEach.call(chapterGrid.querySelectorAll("button"), function(btn){
      btn.addEventListener("click", function(){
        state.current.chapter = parseInt(btn.getAttribute("data-ch"),10);
        renderChapterGrid();
        renderEntry();
      });
    });
  }

  bookSelect.addEventListener("change", function(){
    state.current.book = bookSelect.value;
    state.current.chapter = 1;
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
  var fields = {
    history: document.getElementById("f-history"),
    geography: document.getElementById("f-geography"),
    promises: document.getElementById("f-promises"),
    commands: document.getElementById("f-commands"),
    summary: document.getElementById("f-summary"),
    question: document.getElementById("f-question")
  };
  var form = document.getElementById("entryForm");
  var clearBtn = document.getElementById("clearBtn");
  var sectionsList = document.getElementById("sectionsList");
  var addSectionBtn = document.getElementById("addSectionBtn");

  var clearArmed = false;
  var clearArmedTimer = null;
  var sectionSeq = 0;

  function sectionRowHtml(s){
    sectionSeq++;
    var domId = "sec-" + sectionSeq;
    return '<div class="section-row" data-id="'+esc(s.id)+'">'+
      '<div class="section-row-head">'+
        '<input type="text" class="section-title" data-role="title" placeholder="Section title — e.g. vv. 1–10" value="'+esc(s.title||"")+'">'+
        '<button type="button" class="section-remove" data-role="remove" aria-label="Remove section">✕</button>'+
      '</div>'+
      '<textarea rows="2" data-role="text" placeholder="What do you notice here?">'+esc(s.text||"")+'</textarea>'+
    '</div>';
  }

  function renderSections(sections){
    if (!sections || !sections.length){
      sectionsList.innerHTML = '<p class="sections-empty">No sections yet — break this chapter up if it helps.</p>';
      return;
    }
    sectionsList.innerHTML = sections.map(sectionRowHtml).join("");
    Array.prototype.forEach.call(sectionsList.querySelectorAll('[data-role="remove"]'), function(btn){
      btn.addEventListener("click", function(){
        btn.closest(".section-row").remove();
        if (!sectionsList.querySelector(".section-row")){
          sectionsList.innerHTML = '<p class="sections-empty">No sections yet — break this chapter up if it helps.</p>';
        }
      });
    });
  }

  function readSectionsFromDom(){
    var rows = sectionsList.querySelectorAll(".section-row");
    var out = [];
    Array.prototype.forEach.call(rows, function(row){
      var title = row.querySelector('[data-role="title"]').value.trim();
      var text = row.querySelector('[data-role="text"]').value.trim();
      if (title || text){
        out.push({id: row.getAttribute("data-id") || ("s"+Date.now()+Math.random().toString(36).slice(2,6)), title:title, text:text});
      }
    });
    return out;
  }

  addSectionBtn.addEventListener("click", function(){
    var placeholder = sectionsList.querySelector(".sections-empty");
    if (placeholder) sectionsList.innerHTML = "";
    var newId = "s" + Date.now() + Math.random().toString(36).slice(2,6);
    sectionsList.insertAdjacentHTML("beforeend", sectionRowHtml({id:newId, title:"", text:""}));
    var rows = sectionsList.querySelectorAll(".section-row");
    var last = rows[rows.length-1];
    var removeBtn = last.querySelector('[data-role="remove"]');
    removeBtn.addEventListener("click", function(){
      removeBtn.closest(".section-row").remove();
      if (!sectionsList.querySelector(".section-row")){
        sectionsList.innerHTML = '<p class="sections-empty">No sections yet — break this chapter up if it helps.</p>';
      }
    });
    last.querySelector('[data-role="title"]').focus();
  });

  function renderEntry(){
    var book = findBook(state.current.book);
    var k = key(book.name, state.current.chapter);
    var e = state.entries[k] || {};
    entryTitle.textContent = book.name + " " + state.current.chapter;
    exampleFlag.hidden = k !== EXAMPLE_KEY;
    fields.history.value = e.history || "";
    fields.geography.value = e.geography || "";
    fields.promises.value = e.promises || "";
    fields.commands.value = e.commands || "";
    fields.summary.value = e.summary || "";
    fields.question.value = e.question || "";
    renderSections(e.sections);
    prevBtn.disabled = state.current.chapter<=1;
    nextBtn.disabled = state.current.chapter>=book.chapters;
    if (clearArmed){
      clearTimeout(clearArmedTimer);
      clearArmed = false;
      clearBtn.textContent = "Clear this chapter";
      clearBtn.classList.remove("confirming");
    }
  }

  prevBtn.addEventListener("click", function(){
    if (state.current.chapter>1){ state.current.chapter--; renderChapterGrid(); renderEntry(); }
  });
  nextBtn.addEventListener("click", function(){
    var book = findBook(state.current.book);
    if (state.current.chapter<book.chapters){ state.current.chapter++; renderChapterGrid(); renderEntry(); }
  });

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    var book = findBook(state.current.book);
    var k = key(book.name, state.current.chapter);
    state.entries[k] = {
      history: fields.history.value.trim(),
      geography: fields.geography.value.trim(),
      promises: fields.promises.value.trim(),
      commands: fields.commands.value.trim(),
      summary: fields.summary.value.trim(),
      question: fields.question.value.trim(),
      sections: readSectionsFromDom()
    };
    exampleFlag.hidden = true;
    renderChapterGrid();
    persist("Saved " + book.name + " " + state.current.chapter);
  });

  clearBtn.addEventListener("click", function(){
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
    var historyItems = [], geoItems = [], promiseItems = [], commandItems = [];
    state.books.forEach(function(book){
      for (var c=1;c<=book.chapters;c++){
        var e = state.entries[key(book.name,c)];
        if (!e) continue;
        var ref = book.name + " " + c;
        if (e.history) historyItems.push({ref:ref, text:e.summary || e.history});
        if (e.geography) {
          e.geography.split(",").map(function(s){return s.trim();}).filter(Boolean).forEach(function(place){
            geoItems.push({ref:ref, text:place});
          });
        }
        if (e.promises && !/^none\b/i.test(e.promises.trim())) promiseItems.push({ref:ref, text:e.promises});
        if (e.commands && !/^none\b/i.test(e.commands.trim())) commandItems.push({ref:ref, text:e.commands});
        if (e.sections && e.sections.length){
          e.sections.forEach(function(s){
            if (s.text) historyItems.push({ref: ref + (s.title? " — "+s.title : ""), text: s.text});
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
    fill("list-history", historyItems, "Nothing logged yet — save a chapter's history notes to start your timeline.");
    fill("list-geography", geoItems, "No places logged yet — list them, comma-separated, in a chapter's Geography field.");
    fill("list-promises", promiseItems, "No promises logged yet.");
    fill("list-commands", commandItems, "No commands logged yet.");
  }

  // ---------- Boot ----------
  renderBookSelect();
  renderChapterGrid();
  renderEntry();
})();
