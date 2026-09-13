export type MaterialNote = { name: string; note: string; gotcha?: string };

/** Folder notes + known data problems, ported from Study_Dashboard.html. */
export const MATERIAL: MaterialNote[] = [
 {name:"C_Programming_ClassWork/CProgramming",note:"Day1–Day13 (PDFs + code/) · Assignments/assign01–11.pdf · MCQ/Day01–15 · POLL/Day01–18 · PreCAT_Syllabus (1).pdf",
  gotcha:"PDF naming off-by-one hai: DayN folder me lecture PDF aksar Day(N+1)/Day(N+2) ke naam se hai. Diagrams + code sahi jagah hain."},
 {name:"sunbeam data structure/DataStructure",note:"Day01–Day05 · MCQ/Day01–08 · Poll_Questions/Day01–08 · Time_Space_Complexity.xlsx",
  gotcha:"Day03 aur Day04 me lecture PDF nahi hai — sirf diagrams. Sort/Stack/Queue ke notes doosre day folders + internet se cover karo."},
 {name:"sunbeam cpp/ObjectOrientedProgramming",note:"CPP_day1–CPP_day5 · assignments · PD_CPP-DAY1…5.pdf · MCQ_OPPS/Day01–07 · Poll_OOPS/Day01–07",
  gotcha:"PD_CPP-DAY5.pdf ek level upar repo root me hai. Git me purane .zip delete ho chuke hain (uncommitted)."},
 {name:"sunbeam os and cf/CF-OS",note:"day1–day6 · Day-1…Day-6_1.pdf (root me duplicate) · disk algo.pdf · page_R_algo.pdf · Semaphore.txt · OS_POLL_MCQ_2026/",
  gotcha:"day2–day5 me MCQ/Poll PDF ka day number ek pichhe hai (day2 folder me Day01_MCQ.pdf)."},
 {name:"sunbeam dcn/DCN",note:"Day_01–Day_03 (lecture + Notes) · MCQs/Day01–03 · Poll_Questions/Day01–03 · Day_03/DCN_MCQs.pdf"},
 {name:"suneam apptitude/Aptitude",note:"Day_01–Day_07 · English_Data/ (Wren&Martin, Idioms, Prepositions, Synonyms, Word Power) · MCQs/Day01–06 · Poll_Questions/Day01–06 · 3 RS Aggarwal books",
  gotcha:"Folder ka naam typo hai: 'suneam' (sunbeam nahi)."},
 {name:"sunbeam bigdata/BigData",note:"day1–day3 · DataEngg-Day1…3.pdf · MCQ + Poll per day"},
 {name:"sun/Artificial-Intelligence",note:"Day_01–Day_02 · AI_Day01/02_notes.pdf · AI_MCQs.txt (50 solved) · MCQs/Day01–02 · Poll_Questions/Day01–02"},
 {name:"quize pdfs",note:"Quiz_Questions_and_Solutions.pdf · Quiz_Solutions.pdf · complete_aptitude_quiz.pdf · c quize.txt (20 C output questions)"},
 {name:"sunbeam practices",note:"notes.txt (C/CF facts) · formule.txt (bitwise tricks) · chapter2.c · chapter3.c · practice.c",
  gotcha:"a.exe compiled binary bhi checked in hai — ignore karo."},
 {name:"extract_pdf_text.py",note:"PDF se text nikalne ka script: python3 extract_pdf_text.py \"<file.pdf>\"",
  gotcha:"Script me bug hai — hardcoded font objects (6,7,8) aur ek dead line; har PDF pe kaam nahi karega."}
];
