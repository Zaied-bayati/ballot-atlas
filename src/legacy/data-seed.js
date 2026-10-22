// Texas, Nov 3 2026 general election. Researched Oct 22, 2026 from the sources cited on
// each record. In step 3 the daily research agent rewrites this same shape.
(function () {
  const SRC = {
    ballotStatewide: { label: "KPRC Click2Houston: guide to the statewide ballot (Oct 7, 2026)", url: "https://www.click2houston.com/news/local/2026/10/07/who-is-running-in-texas-in-november-a-guide-to-the-2026-statewide-ballot/" },
    dates: { label: "KPRC Click2Houston: Texas voter guide (Oct 2, 2026)", url: "https://www.click2houston.com/decision-2026/2026/10/02/texas-voter-guide-2026-what-to-know-before-the-nov-3-election/" },
    houseList: { label: "WhatDistrictAmIIn: 2026 Texas congressional candidates (from Secretary of State certification)", url: "https://whatdistrictamiin.com/2026-elections-texas/" },
    senateQA: { label: "Texas Tribune: Paxton, Talarico and Brown on the issues (Oct 13, 2026)", url: "https://www.texastribune.org/2026/10/13/talarico-paxton-texas-us-senate-2026-election-q-and-a/" },
    senateWiki: { label: "Wikipedia: 2026 U.S. Senate election in Texas", url: "https://en.wikipedia.org/wiki/2026_United_States_Senate_election_in_Texas" },
    govKSAT: { label: "KSAT: Abbott and Hinojosa offer competing visions (Oct 20, 2026)", url: "https://www.ksat.com/news/local/2026/10/20/greg-abbott-gina-hinojosa-offer-competing-visions-for-texas-in-governors-race/" },
    govWiki: { label: "Wikipedia: 2026 Texas gubernatorial election", url: "https://en.wikipedia.org/wiki/2026_Texas_gubernatorial_election" },
    ltgTPR: { label: "Texas Public Radio: Goodwin gives Patrick his toughest race yet (Oct 15, 2026)", url: "https://www.tpr.org/government-politics/2026-10-15/outspent-and-unknown-democrat-vikki-goodwin-gives-lt-gov-dan-patrick-his-toughest-race-yet" },
    ltgWiki: { label: "Wikipedia: 2026 Texas lieutenant gubernatorial election", url: "https://en.wikipedia.org/wiki/2026_Texas_lieutenant_gubernatorial_election" },
    agTrib: { label: "Texas Tribune: What to know about the attorney general race (Oct 5, 2026)", url: "https://www.texastribune.org/2026/10/05/texas-attorney-general-election-2026-candidates-mayes-middleton-nathan-johnson-tom-oxford/" },
    agWiki: { label: "Wikipedia: 2026 Texas Attorney General election", url: "https://en.wikipedia.org/wiki/2026_Texas_Attorney_General_election" },
    travisBallot: { label: "Travis County Clerk: March 2026 primary ballots", url: "https://votetravis.gov/wp-content/uploads/P26-Bedsheet-Ballot-DEM-FINALV2.pdf" },
    travisBrown: { label: "Branch: Andy Brown candidate profile", url: "https://branch.vote/races/2026-texas-general-election-tx-state-county-judge-tx-county-travis/candidates/andy-brown" },
    harrisJudge: { label: "Wikipedia: 2026 Harris County Judge election", url: "https://en.wikipedia.org/wiki/2026_Harris_County_Judge_election" },
    harrisBallot: { label: "The Ballot Brief: Harris County 2026 ballot", url: "https://theballotbrief.com/state/texas/harris-county" },
    harrisDistricts: { label: "FOX 26 Houston: Harris County sample ballots and key races", url: "https://www.fox26houston.com/election/texas-midterm-election-2026-harris-county-sample-ballots-key-races" },
    dallasRaces: { label: "NBC 5 DFW: all Dallas County 2026 races and propositions", url: "https://www.nbcdfw.com/news/politics/lone-star-politics/dallas-county-races-2026-midterm-election/4093575/" },
    dallasJudge: { label: "Vote the Person: Dallas County Judge 2026", url: "https://votetheperson.org/races/dallas-county-judge-2026/" },
    dallasTRE: { label: "Dallas County: tax year 2026 tax rate election", url: "https://www.dallascounty.org/about-us/hot-links/ty2026-taxrate-election.php" },
    bexarJudge: { label: "Wikipedia: 2026 Bexar County Judge election", url: "https://en.wikipedia.org/wiki/2026_Bexar_County_Judge_election" },
    bexarHouse: { label: "San Antonio Report: congressional candidates in Bexar County", url: "https://sanantonioreport.org/candidates-running-for-congress-bexar-county-2026/" },
    epPrimary: { label: "KFOX14: El Paso March 2026 primary results", url: "https://kfoxtv.com/news/local/el-paso-march-primary-2026-election-results" },
    epSamaniego: { label: "KTSM: Samaniego running for third term", url: "https://www.ktsm.com/news/your-local-election-hq/samaniego-running-for-3rd-term-as-county-judge/amp/" },
    collier: { label: "Ballot Access News: court won't put Collier on the ballot (Aug 10, 2026)", url: "https://ballot-access.org/2026/08/10/u-s-district-court-wont-put-michael-collier-on-texas-ballot-as-an-independent-candidate/" }
  };

  // Shorthand for candidates the research pass has not profiled yet.
  const basic = (name, party, status, extra) => Object.assign({
    name, party, status: status || "", occupation: "", summary: "",
    objectives: [], positions: [], history: [], news: [], sources: []
  }, extra || {});

  const candidates = {
    // ---- U.S. Senate
    "paxton": basic("Ken Paxton", "Republican", "Open seat", {
      occupation: "Texas Attorney General",
      summary: "Attorney general since 2015 after 10 years in the Texas House and two in the Texas Senate. Won the May 26 Republican runoff over Sen. John Cornyn with 63.8% after President Trump endorsed him. He was impeached by the Texas House in 2023 and acquitted on all charges by the Texas Senate. Did not answer the Texas Tribune questionnaire, so positions below come from his past public statements.",
      positions: [
        { topic: "Gas tax", stance: "Supports permanently repealing the federal gas tax and keeping oil and gas regulation low to raise production." },
        { topic: "Data centers", stance: "Supports efficient water use, having the industry pay its own infrastructure costs, ending state sales tax breaks, and keeping facilities away from homes." },
        { topic: "Iran and war powers", stance: "Backs the president's actions on Iran; says he will decide on funding after getting more intelligence." },
        { topic: "Border wall in Big Bend", stance: "Called the plans \"not smart border security\" and welcomed the August pause." },
        { topic: "Gender care for minors", stance: "Opposes it; as attorney general he extended the state ban to mental health providers." },
        { topic: "Marijuana and hemp", stance: "Has sued Dallas over marijuana decriminalization; no direct comment found on Texas THC rules." }
      ],
      history: ["Texas Attorney General, 2015–present", "Texas Senate, 2 years", "Texas House, 10 years (McKinney area)"],
      news: [
        { date: "2026-10-22", outlet: "Washington Times", headline: "Ken Paxton says he would debate James Talarico in Texas Senate race 'if the terms were right'", url: "https://www.washingtontimes.com/news/2026/oct/22/ken-paxton-says-would-debate-james-talarico-texas-senate-race-terms/" },
        { date: "2026-10-07", outlet: "Texas Tribune", headline: "Texas Republicans are refusing to debate for the election", url: "https://www.texastribune.org/2026/10/07/texas-debate-republicans-talarico-paxton-abbott-hinojosa-election/" }
      ],
      sources: [SRC.senateQA, SRC.senateWiki]
    }),
    "talarico": basic("James Talarico", "Democratic", "Open seat", {
      occupation: "State representative; former middle school teacher",
      summary: "In his fourth term in the Texas House representing parts of North Austin. Previously taught at Rhodes Middle School in San Antonio ISD. Won the Democratic nomination with 52.4% over U.S. Rep. Jasmine Crockett.",
      positions: [
        { topic: "Gas tax", stance: "Supports suspending the federal gas tax and ending the Iran war to lower fuel costs." },
        { topic: "Data centers", stance: "Wants data centers to pay their own infrastructure costs, end their tax breaks, and let communities decide where they go." },
        { topic: "Iran and war powers", stance: "Will vote for a war powers resolution to end the war and restore Senate oversight." },
        { topic: "Border wall in Big Bend", stance: "Opposes a wall through Big Bend; proposes more agents, judges, surveillance technology, and barriers where needed." },
        { topic: "Gender care for minors", stance: "Does not support gender surgery for minors; criticizes what he calls political attacks on children." },
        { topic: "Marijuana and hemp", stance: "Supports legal, regulated adult marijuana with taxes funding public safety and health programs." },
        { topic: "Tariffs", stance: "Wants them repealed, saying they raise family costs and cost jobs." }
      ],
      history: ["Texas House of Representatives, fourth term (North Austin)", "Teacher, Rhodes Middle School (San Antonio ISD)", "Worked at education nonprofit Reasoning Mind"],
      news: [
        { date: "2026-10-22", outlet: "Washington Times", headline: "Ken Paxton says he would debate James Talarico in Texas Senate race 'if the terms were right'", url: "https://www.washingtontimes.com/news/2026/oct/22/ken-paxton-says-would-debate-james-talarico-texas-senate-race-terms/" },
        { date: "2026-10-07", outlet: "Texas Tribune", headline: "Texas Republicans are refusing to debate for the election", url: "https://www.texastribune.org/2026/10/07/texas-debate-republicans-talarico-paxton-abbott-hinojosa-election/" }
      ],
      sources: [SRC.senateQA, SRC.senateWiki]
    }),
    "ted-brown": basic("Ted Brown", "Libertarian", "Open seat", {
      occupation: "Independent insurance adjuster",
      summary: "Vice chair of the Libertarian Party of Travis County and a party member for nearly 50 years, including as former chair of the Libertarian Party of California. B.A. in political science from UCLA.",
      positions: [
        { topic: "Gas tax", stance: "Would repeal the federal gas tax entirely." },
        { topic: "Data centers", stance: "Generally opposes regulation but sees merit in requiring power and water plans and banning taxpayer subsidies and eminent domain." },
        { topic: "Iran and war powers", stance: "Supports every war powers resolution and wants U.S. troops withdrawn from the Middle East." },
        { topic: "Border wall in Big Bend", stance: "Wants Congress to bar a wall in Big Bend and stop further border wall construction." },
        { topic: "Gender care for minors", stance: "Opposes government control over doctor-patient decisions; does not advocate surgery for minors." },
        { topic: "Marijuana and hemp", stance: "Wants cannabis removed from federal drug scheduling and past marijuana convictions expunged." },
        { topic: "Tariffs", stance: "Says only Congress can set tariffs; supports free trade." }
      ],
      history: ["Vice chair, Libertarian Party of Travis County", "Former chair, Libertarian Party of California", "B.A., UCLA, 1984"],
      sources: [SRC.senateQA]
    }),

    // ---- Governor
    "abbott": basic("Greg Abbott", "Republican", "Incumbent", {
      occupation: "Governor of Texas",
      summary: "Governor since 2015, seeking a fourth term. Polls in September and early October showed a close race; a YouGov poll from Sept. 28 to Oct. 5 had Hinojosa at 48% and Abbott at 47%, within the margin of error.",
      positions: [
        { topic: "Property taxes", stance: "Campaigns on property tax relief and has pursued tax cuts during his tenure." },
        { topic: "Schools", stance: "Championed the education savings account program; proposes limiting classroom devices and requiring 70% of district funding to go to classroom instruction." },
        { topic: "Higher education", stance: "Proposes tuition discounts for summer courses at four-year Texas universities." },
        { topic: "Border and public safety", stance: "Campaigns on border security." }
      ],
      history: ["Governor of Texas, 2015–present"],
      news: [
        { outlet: "Yahoo News", headline: "As Hinojosa stages debate at Governor's Mansion, Texas Gov. Abbott defends decision not to debate", url: "https://www.yahoo.com/news/politics/articles/hinojosa-stages-debate-governors-mansion-211405798.html" },
        { date: "2026-10-20", outlet: "KSAT", headline: "Greg Abbott, Gina Hinojosa offer competing visions for Texas in governor's race", url: SRC.govKSAT.url }
      ],
      sources: [SRC.govKSAT, SRC.govWiki]
    }),
    "hinojosa": basic("Gina Hinojosa", "Democratic", "Challenger", {
      occupation: "State representative; civil rights attorney",
      summary: "Represents Austin's House District 49 since 2017. Won the March 3 Democratic primary with about 58.5% of the vote.",
      positions: [
        { topic: "Property taxes", stance: "Has said she wants to eliminate homeowners' property taxes; opposes a state income tax." },
        { topic: "Schools", stance: "Wants to end the education savings account program, increase public school funding, and change testing and accountability rules." },
        { topic: "Cost of living", stance: "Proposes a $1,500 payment to Texas families from the state's Rainy Day Fund." },
        { topic: "Data centers", stance: "Has criticized data center tax breaks and cited electricity bills as a household cost concern." }
      ],
      history: ["Texas House of Representatives, District 49, 2017–present"],
      news: [
        { outlet: "Yahoo News", headline: "As Hinojosa stages debate at Governor's Mansion, Texas Gov. Abbott defends decision not to debate", url: "https://www.yahoo.com/news/politics/articles/hinojosa-stages-debate-governors-mansion-211405798.html" },
        { date: "2026-10-20", outlet: "KSAT", headline: "Greg Abbott, Gina Hinojosa offer competing visions for Texas in governor's race", url: SRC.govKSAT.url }
      ],
      sources: [SRC.govKSAT, SRC.govWiki, { label: "Houston Chronicle: Gina Hinojosa wants to eliminate homeowners' property taxes. But how?", url: "https://www.houstonchronicle.com/politics/texas/article/gina-hinojosa-property-taxes-22463261.php" }]
    }),
    "dixon": basic("Pat Dixon", "Libertarian", "Challenger", {
      summary: "Former chair of the Libertarian Party of Texas. Polled between 1% and 6% when included. No campaign positions were found in our sources.",
      history: ["Former chair, Libertarian Party of Texas"],
      sources: [SRC.govWiki]
    }),

    // ---- Lieutenant Governor
    "patrick": basic("Dan Patrick", "Republican", "Incumbent", {
      occupation: "Lieutenant Governor of Texas",
      summary: "Lieutenant governor since 2015. Endorsed by President Trump and Gov. Abbott. Reported about $24 million cash on hand in the latest filings.",
      positions: [
        { topic: "Hemp and THC", stance: "Has pushed a near-total ban on hemp-derived THC products." },
        { topic: "Schools", stance: "Supports school vouchers (education savings accounts)." },
        { topic: "School libraries", stance: "Has pressed school districts to remove books he calls obscene." }
      ],
      history: ["Lieutenant Governor, 2015–present"],
      news: [{ date: "2026-10-15", outlet: "Texas Public Radio", headline: "Outspent and unknown, Democrat Vikki Goodwin gives Lt. Gov. Dan Patrick his toughest race yet", url: SRC.ltgTPR.url }],
      sources: [SRC.ltgTPR, SRC.ltgWiki]
    }),
    "goodwin": basic("Vikki Goodwin", "Democratic", "Challenger", {
      occupation: "State representative",
      summary: "Austin state representative who flipped a Republican-held House seat in 2018. Won the May 26 runoff with 67.8%. Reported about $643,000 cash on hand in the latest filings.",
      positions: [
        { topic: "Hemp and THC", stance: "Opposes the THC ban." },
        { topic: "Schools", stance: "Wants the state to pay a larger share of public school funding; opposes school vouchers." },
        { topic: "Health care", stance: "Proposes a state-run public health insurance option paid for partly by a new cannabis tax." },
        { topic: "School curriculum", stance: "Says school districts should be free to teach diversity, equity and inclusion." }
      ],
      history: ["Texas House of Representatives, District 47, 2019–present"],
      news: [{ date: "2026-10-15", outlet: "Texas Public Radio", headline: "Outspent and unknown, Democrat Vikki Goodwin gives Lt. Gov. Dan Patrick his toughest race yet", url: SRC.ltgTPR.url }],
      sources: [SRC.ltgTPR, SRC.ltgWiki]
    }),
    "cristo": basic("Anthony Cristo", "Libertarian", "Challenger", {
      summary: "Libertarian nominee for Congress in Texas's 15th District in 2018 and 34th District in 2020. No campaign positions were found in our sources.",
      sources: [SRC.ltgWiki]
    }),
    "mccormick": basic("Kevin McCormick", "Green", "Challenger", {
      summary: "Former teacher. No campaign positions were found in our sources.",
      sources: [SRC.ltgWiki]
    }),

    // ---- Attorney General
    "middleton": basic("Mayes Middleton", "Republican", "Open seat", {
      occupation: "State senator; president of Middleton Oil Company",
      summary: "Texas Senate since 2023 after four years in the Texas House. Won the May 26 runoff over U.S. Rep. Chip Roy with 55.2%. University of Texas School of Law graduate.",
      positions: [
        { topic: "Border", stance: "Says he would enforce President Trump's border agenda." },
        { topic: "Abortion", stance: "Says he would uphold the state's anti-abortion laws." },
        { topic: "Energy", stance: "Says he would protect oil and gas jobs." }
      ],
      history: ["Texas Senate, District 11, 2023–present", "Texas House, 2019–2023", "President, Middleton Oil Company"],
      sources: [SRC.agTrib, SRC.agWiki]
    }),
    "johnson": basic("Nathan Johnson", "Democratic", "Open seat", {
      occupation: "State senator; litigator and mediator",
      summary: "Texas Senate since 2019 representing part of Dallas County. Won the May 26 runoff with 60.5%.",
      positions: [
        { topic: "Federal policy", stance: "Promises to challenge Trump administration policies he says harm the Texas economy." },
        { topic: "Public integrity", stance: "Says he would investigate elected officials regardless of party." },
        { topic: "Core services", stance: "Would focus the office on child support collection and consumer protection." }
      ],
      history: ["Texas Senate, District 16, 2019–present", "Attorney, Thompson Coburn (Dallas)"],
      sources: [SRC.agTrib, SRC.agWiki]
    }),
    "oxford": basic("Tom Oxford", "Libertarian", "Open seat", {
      occupation: "Attorney, Oxford Law PLLC (Jefferson County)",
      summary: "Has practiced law since 1982. The Texas Tribune found no public information on his policy stances.",
      history: ["Attorney since 1982", "University of Texas; University of Houston College of Law"],
      sources: [SRC.agTrib]
    }),

    // ---- Other statewide executive offices (not yet profiled)
    "huffines": basic("Don Huffines", "Republican", "Incumbent", { summary: "Won the Republican primary and was appointed comptroller in July 2026.", sources: [SRC.ballotStatewide] }),
    "eckhardt": basic("Sarah Eckhardt", "Democratic", "Challenger", { sources: [SRC.ballotStatewide] }),
    "echavarria": basic("V. Alonzo Echavarria-Garza", "Libertarian", "Challenger", { sources: [SRC.ballotStatewide] }),
    "faizi": basic("Shehla Faizi", "Green", "Challenger", { sources: [SRC.ballotStatewide] }),
    "buckingham": basic("Dawn Buckingham", "Republican", "Incumbent", { sources: [SRC.ballotStatewide] }),
    "flores-b": basic("Benjamin Flores", "Democratic", "Challenger", { sources: [SRC.ballotStatewide] }),
    "snider": basic("Neill Snider", "Libertarian", "Challenger", { sources: [SRC.ballotStatewide] }),
    "sheets": basic("Nate Sheets", "Republican", "", { sources: [SRC.ballotStatewide] }),
    "tucker": basic("Clayton Tucker", "Democratic", "", { sources: [SRC.ballotStatewide] }),
    "kelly-a": basic("Austin R. Kelly", "Libertarian", "", { sources: [SRC.ballotStatewide] }),
    "french": basic("Bo French", "Republican", "", { sources: [SRC.ballotStatewide] }),
    "rosenthal": basic("Jon Rosenthal", "Democratic", "", { sources: [SRC.ballotStatewide] }),
    "dibianca": basic("Arthur DiBianca", "Libertarian", "", { sources: [SRC.ballotStatewide] }),

    // ---- County judges
    "andy-brown": basic("Andy Brown", "Democratic", "Incumbent", {
      occupation: "Travis County Judge; attorney",
      summary: "Listed as unopposed for this office. Grew up in Austin and helped establish Sobering Center Austin.",
      positions: [
        { topic: "Homelessness and housing", stance: "Directed $110 million in federal Rescue Act funds to homelessness and backs expanded stable housing." },
        { topic: "Public safety", stance: "Favors crime prevention, behavioral health services and diversion over building new jails." },
        { topic: "Transportation", stance: "Is advancing a passenger rail link between Austin and San Antonio." },
        { topic: "Child care", stance: "Supports county child care scholarships." }
      ],
      history: ["Travis County Judge, 2020–present", "Colorado College; University of Texas School of Law"],
      sources: [SRC.travisBrown, SRC.travisBallot]
    }),
    "plummer": basic("Letitia Plummer", "Democratic", "Open seat", {
      occupation: "Former Houston City Council member",
      summary: "Won the May 26 Democratic runoff over former Houston Mayor Annise Parker with 51.1%. Incumbent Lina Hidalgo is not running.",
      history: ["Houston City Council, at-large, 2020–2025"],
      sources: [SRC.harrisJudge, SRC.harrisBallot]
    }),
    "sanchez-o": basic("Orlando Sanchez", "Republican", "Open seat", {
      occupation: "Former Harris County Treasurer",
      summary: "Won the Republican runoff with 63.3%.",
      history: ["Harris County Treasurer, 2007–2018"],
      sources: [SRC.harrisJudge, SRC.harrisBallot]
    }),
    "jenkins": basic("Clay Jenkins", "Democratic", "Incumbent", {
      occupation: "Dallas County Judge; attorney",
      summary: "First elected in 2010 and seeking a fifth term. Voted in August to put the county's homelessness tax rate increase (Proposition A) on the ballot.",
      history: ["Dallas County Judge, 2011–present", "Baylor University (B.A., J.D.)"],
      sources: [SRC.dallasJudge, SRC.dallasRaces]
    }),
    "immler": basic("Mike Immler", "Republican", "Challenger", {
      occupation: "Retired U.S. Air Force colonel; attorney",
      summary: "First-time candidate. Served 30 years in the Air Force and reserves and later was vice president of military affairs at First Command Financial Services. No public issue positions were found.",
      sources: [SRC.dallasJudge]
    }),
    "nirenberg": basic("Ron Nirenberg", "Democratic", "Open seat", {
      occupation: "Former mayor of San Antonio",
      summary: "Defeated incumbent County Judge Peter Sakai in the March 3 Democratic primary with 62.2%.",
      history: ["Mayor of San Antonio, 2017–2025"],
      sources: [SRC.bexarJudge]
    }),
    "von-dohlen": basic("Patrick Von Dohlen", "Republican", "Open seat", {
      occupation: "Financial adviser",
      summary: "Unopposed in the Republican primary. Ran for San Antonio City Council in 2017, 2019 and 2021.",
      sources: [SRC.bexarJudge]
    }),
    "samaniego": basic("Ricardo Samaniego", "Democratic", "Incumbent", {
      occupation: "El Paso County Judge",
      summary: "First elected in 2018, seeking a third term he says would be his last. Has highlighted a planned Meta AI data center in Northeast El Paso and a comprehensive cancer center at Texas Tech Health El Paso.",
      history: ["El Paso County Judge, 2019–present"],
      sources: [SRC.epSamaniego, SRC.epPrimary]
    }),
    "shelton": basic("Minerva Torres Shelton", "Republican", "Challenger", {
      summary: "Led the March 3 Republican primary with 62% in early returns, over Guadalupe Giner. We could not yet confirm the final result.",
      sources: [SRC.epPrimary]
    })
  };

  // U.S. House: [district, [[name, party, incumbent?], ...]] from the SOS-certified list.
  const HOUSE = {
    2: [["Steve Toth", "Republican"], ["Shaun Finnie", "Democratic"]],
    5: [["Lance Gooden", "Republican", 1], ["Chelsey Hockett", "Democratic"]],
    6: [["Jake Ellzey", "Republican", 1], ["Danny Minton", "Democratic"]],
    7: [["Alexander Hale", "Republican"], ["Lizzie Pannill Fletcher", "Democratic", 1], ["Espoir Ngabo", "Green"]],
    8: [["Jessica Hart Steinmann", "Republican"], ["Laura Jones", "Democratic"]],
    9: [["Alex Mealer", "Republican"], ["Leticia Gutierrez", "Democratic"]],
    10: [["Chris Gober", "Republican"], ["Caitlin Rourk", "Democratic"]],
    11: [["August Pfluger", "Republican", 1], ["Claire Reynolds", "Democratic"]],
    16: [["Adam Bauman", "Republican"], ["Veronica Escobar", "Democratic", 1]],
    18: [["Ronald Dwayne Whitfield", "Republican"], ["Christian Dashaun Menefee", "Democratic", 1]],
    20: [["Edgardo Rafael Baez", "Republican"], ["Joaquin Castro", "Democratic", 1]],
    21: [["Mark Teixeira", "Republican"], ["Kristin Hook", "Democratic"]],
    22: [["Trever Nehls", "Republican"], ["Marquette Greene-Scott", "Democratic"]],
    23: [["Brandon Herrera", "Republican"], ["Katy Padilla Stout", "Democratic"], ["Ben Mendoza", "Independent"]],
    24: [["Beth Van Duyne", "Republican", 1], ["Kevin Burge", "Democratic"]],
    27: [["Michael Cloud", "Republican", 1], ["Tanya Lloyd", "Democratic"]],
    29: [["Martha Fierro", "Republican"], ["Sylvia Garcia", "Democratic", 1]],
    30: [["Everett Jackson", "Republican"], ["Frederick D. Haynes III", "Democratic"]],
    32: [["Jace Yarbrough", "Republican"], ["Dan Barrios", "Democratic"]],
    33: [["Patrick David Gillespie", "Republican"], ["Colin Allred", "Democratic"]],
    35: [["Carlos De La Cruz", "Republican"], ["Johnny C. Garcia", "Democratic"]],
    36: [["Brian Babin", "Republican", 1], ["Rhonda Hart", "Democratic"]],
    37: [["Lauren B. Peña", "Republican"], ["Greg Casar", "Democratic"]],
    38: [["Jon Bonck", "Republican"], ["Melissa McDonough", "Democratic"], ["Alex McMenemy", "Green"]]
  };
  const houseRace = (d, srcExtra) => {
    const ids = HOUSE[d].map(([name, party, inc]) => {
      const id = "h" + d + "-" + name.toLowerCase().replace(/[^a-z]+/g, "-");
      candidates[id] = basic(name, party, inc ? "Incumbent" : (HOUSE[d].some(x => x[2]) ? "Challenger" : "Open seat"),
        { sources: [SRC.houseList].concat(srcExtra || []) });
      return id;
    });
    return { id: "tx" + d, level: "federal", district: d, office: `U.S. Representative, District ${d}`, seats: 1, about: "Two-year term. Only voters who live in this district see it on their ballot.", candidates: ids };
  };

  const statewideRace = (id, level, office, about, cands) => ({ id, level, office, seats: 1, about, candidates: cands });

  // Statewide judicial races: names and parties only for now.
  const courts = [
    ["sc-chief", "Supreme Court, Chief Justice", [["Jimmy Blacklock", "Republican"], ["Maggie Ellis", "Democratic"]]],
    ["sc-2", "Supreme Court, Place 2 (unexpired term)", [["James P. Sullivan", "Republican"], ["Chari Kelly", "Democratic"]]],
    ["sc-7", "Supreme Court, Place 7", [["Kyle Hawkins", "Republican"], ["Kristen Hawkins", "Democratic"]]],
    ["sc-8", "Supreme Court, Place 8", [["Brett Busby", "Republican"], ["Gisela D. Triana", "Democratic"]]],
    ["cca-3", "Court of Criminal Appeals, Place 3", [["Thomas Smith", "Republican"], ["Okey Anyiam", "Democratic"], ["Mark Ash", "Libertarian"]]],
    ["cca-4", "Court of Criminal Appeals, Place 4", [["Kevin Patrick Yeary", "Republican"], ["Audra Riley", "Democratic"]]],
    ["cca-9", "Court of Criminal Appeals, Place 9", [["John Messinger", "Republican"], ["Holly Taylor", "Democratic"]]],
    ["coa15-chief", "15th Court of Appeals, Chief Justice", [["Scott Brister", "Republican"], ["Jerry Zimmerer", "Democratic"]]],
    ["coa15-2", "15th Court of Appeals, Place 2", [["Scott K. Field", "Republican"], ["Tom Baker", "Democratic"]]],
    ["coa15-3", "15th Court of Appeals, Place 3", [["April Farris", "Republican"], ["Marc M. Meyer", "Democratic"]]]
  ].map(([id, office, list]) => ({
    id, level: "courts", office, seats: 1, about: "Statewide judicial seat. Six-year term.",
    candidates: list.map(([name, party]) => {
      const cid = id + "-" + name.toLowerCase().replace(/[^a-z]+/g, "-");
      candidates[cid] = basic(name, party, "", { sources: [SRC.ballotStatewide] });
      return cid;
    })
  }));

  const county = (name, site, house, races, voting, measures) => ({
    name, officialSite: site,
    races: house.map(d => houseRace(d)).concat(races),
    houseDistricts: house, voting, measures: measures || []
  });

  window.BALLOT_DATA = {
    meta: {
      sample: false,
      lastResearchRun: "2026-10-22T13:30:00-05:00",
      pilotStateFips: "48"
    },
    states: {
      "48": {
        name: "Texas",
        officialSite: { label: "VoteTexas.gov", url: "https://www.votetexas.gov" },
        dates: [
          { id: "reg", label: "Voter registration deadline", start: "2026-10-05", note: "Last day to register or update your registration." },
          { id: "early", label: "Early voting", start: "2026-10-19", end: "2026-10-30", note: "Vote at any early voting site in your county. Hours vary by county." },
          { id: "mail", label: "Last day to apply for a mail ballot", start: "2026-10-23", note: "The application must be received by your county's early voting clerk." },
          { id: "election", label: "General Election Day", start: "2026-11-03", note: "Polls open 7 a.m. to 7 p.m. Mail ballots must arrive by 7 p.m. (Nov. 4 at 5 p.m. if postmarked by Election Day)." }
        ],
        datesSource: SRC.dates,
        races: [
          statewideRace("us-senate", "federal", "U.S. Senator", "One of Texas's two U.S. senators. Six-year term. Open seat: Sen. John Cornyn lost the Republican runoff.", ["paxton", "talarico", "ted-brown"]),
          statewideRace("governor", "state", "Governor", "Head of the state executive branch. Four-year term.", ["abbott", "hinojosa", "dixon"]),
          statewideRace("lt-gov", "state", "Lieutenant Governor", "Presides over the Texas Senate and controls much of its agenda. Independent Mike Collier sought a spot but a federal court declined to add him to the ballot.", ["patrick", "goodwin", "cristo", "mccormick"]),
          statewideRace("ag", "state", "Attorney General", "The state's chief lawyer. Open seat because Ken Paxton is running for U.S. Senate.", ["middleton", "johnson", "oxford"]),
          statewideRace("comptroller", "state", "Comptroller of Public Accounts", "Collects state taxes and certifies the state budget.", ["huffines", "eckhardt", "echavarria", "faizi"]),
          statewideRace("land", "state", "Commissioner of the General Land Office", "Manages state-owned land and mineral rights, and the Alamo.", ["buckingham", "flores-b", "snider"]),
          statewideRace("ag-comm", "state", "Commissioner of Agriculture", "Oversees farming, ranching and school nutrition programs.", ["sheets", "tucker", "kelly-a"]),
          statewideRace("rrc", "state", "Railroad Commissioner", "Regulates the oil and gas industry. Six-year term.", ["french", "rosenthal", "dibianca"])
        ].concat(courts),
        racesSource: SRC.ballotStatewide,
        measures: [],
        measuresNote: "There are no statewide propositions on this ballot. Texas usually votes on constitutional amendments in odd-numbered years.",
        counties: {
          "48453": county("Travis", { label: "VoteTravis.gov", url: "https://votetravis.gov" }, [10, 11, 27, 37],
            [{ id: "travis-judge", level: "county", office: "Travis County Judge", seats: 1, about: "Leads the Commissioners Court, which sets the county budget. Four-year term.", candidates: ["andy-brown"] }],
            { early: "45 early voting sites, open 7 a.m. to 7 p.m. every day through Oct. 30. Use any site in the county.", electionDay: "About 200 polling locations on Nov. 3.", source: { label: "FOX 7 Austin (Oct 19, 2026)", url: "https://www.fox7austin.com/news/early-voting-travis-county-officials-address-registration-glitches-turnout" } }),
          "48201": county("Harris", { label: "HarrisVotes.com", url: "https://www.harrisvotes.com" }, [2, 7, 8, 9, 18, 22, 29, 36, 38],
            [{ id: "harris-judge", level: "county", office: "Harris County Judge", seats: 1, about: "Leads the Commissioners Court and the county's emergency management. Open seat.", candidates: ["plummer", "sanchez-o"] }],
            { early: "More than 70 early voting centers, open 7 a.m. to 7 p.m. Monday through Saturday and noon to 7 p.m. on Sunday, Oct. 25.", electionDay: "Check HarrisVotes.com or the Harris Votes app for locations and wait times.", source: { label: "KPRC Click2Houston (Oct 19, 2026)", url: "https://www.click2houston.com/news/local/2026/10/19/early-voting-begins-in-harris-county-for-november-2026-elections/" } }),
          "48113": county("Dallas", { label: "DallasCountyVotes.org", url: "https://www.dallascountyvotes.org" }, [5, 6, 24, 30, 32, 33],
            [{ id: "dallas-judge", level: "county", office: "Dallas County Judge", seats: 1, about: "Leads the Commissioners Court, which sets the county budget. Four-year term.", candidates: ["immler", "jenkins"] }],
            { early: "Open 7 a.m. to 7 p.m. daily, except noon to 6 p.m. on Sunday, Oct. 25.", electionDay: "Find vote centers at DallasCountyVotes.org.", source: { label: "FOX 4 Dallas-Fort Worth", url: "https://www.fox4news.com/election/dallas-county-nov-3-general" } },
            [{ id: "dallas-prop-a", title: "Dallas County Proposition A (tax rate)", summary: "Approves a county property tax rate of $0.24865 per $100 of value, 2.4 cents above the rate the county can set without voter approval. The ballot calls it a tax increase.", forMeans: "The higher rate takes effect. The county estimates about $102.9 million more a year, to be spent on homelessness, encampments, mental health treatment and stable housing.", againstMeans: "The county's rate falls to the voter-approval rate of $0.22465 per $100, and that added money is not raised.", source: SRC.dallasTRE }]),
          "48029": county("Bexar", { label: "Bexar County Elections", url: "https://elections.bexar.org" }, [20, 21, 23, 35],
            [{ id: "bexar-judge", level: "county", office: "Bexar County Judge", seats: 1, about: "Leads the Commissioners Court. Open seat: incumbent Peter Sakai lost the Democratic primary.", candidates: ["nirenberg", "von-dohlen"] }],
            { early: "58 early voting sites. The main site at 1103 S. Frio St. is open 7 a.m. to 7 p.m. Oct. 26–30; other sites' hours vary.", electionDay: "Check Bexar County Elections for Election Day sites.", source: { label: "KSAT (Oct 6, 2026)", url: "https://www.ksat.com/news/local/2026/10/06/what-to-know-about-early-voting-in-bexar-county-for-nov-3-midterm-election/" } }),
          "48141": county("El Paso", { label: "EPCountyVotesTX.gov", url: "https://epcountyvotestx.gov/voter-information/early-voting-locations" }, [16, 23],
            [{ id: "ep-judge", level: "county", office: "El Paso County Judge", seats: 1, about: "Leads the Commissioners Court. Four-year term.", candidates: ["samaniego", "shelton"], verify: "The Republican nominee is based on early primary returns. Confirm on your sample ballot." }],
            { early: "Vote at any early voting location in the county through Oct. 30. Hours differ by site.", electionDay: "Check EPCountyVotesTX.gov for Election Day sites.", source: { label: "El Paso County Elections", url: "https://epcountyvotestx.gov/voter-information/early-voting-locations" } })
        }
      }
    },
    candidates
  };
})();
