"use strict";(self.webpackChunkfrontend=self.webpackChunkfrontend||[]).push([[716],{716:(e,t,n)=>{n.r(t),n.d(t,{default:()=>i});var s=n(43),c=n(837),l=n(488),r=n.n(l),a=n(579);const i=function(){const[e,t]=(0,s.useState)([]),[n,l]=(0,s.useState)(!0),[i,o]=(0,s.useState)(null),d=r().getSelectedCompetition();return(0,s.useEffect)((()=>{const e=r().getSelectedClub();if(e){const n=async()=>{try{const n=await(0,c.l7)(e.cl_no);let s=null;for(const e of n)if(e.competitionName===d){s=e;break}if(!s)throw new Error("Aucun match trouv\xe9 pour la comp\xe9tition s\xe9lectionn\xe9e.");{const e=s.competitionNumber,n=s.phaseNumber,l=s.pouleNumber,r=await(0,c.zf)(e,n,l);t(r)}l(!1)}catch(i){o(i),l(!1)}};n()}else o(new Error("Aucun club s\xe9lectionn\xe9.")),l(!1);r().onClubChange((e=>{l(!0),o(null),t([]);(async()=>{try{const n=await(0,c.l7)(e.cl_no);let s=null;for(const e of n)if(e.competitionName===d){s=e;break}if(!s)throw new Error("Aucun match trouv\xe9 pour la comp\xe9tition s\xe9lectionn\xe9e.");{const e=s.competitionNumber,n=s.phaseNumber,l=s.pouleNumber,r=await(0,c.zf)(e,n,l);t(r)}l(!1)}catch(i){o(i),l(!1)}})()}))}),[]),n?(0,a.jsx)("div",{children:"Chargement des classements..."}):i?(0,a.jsxs)("div",{children:["Erreur lors du chargement des classements : ",i.message]}):(0,a.jsx)("div",{className:"classement-content",children:e.length>0?(0,a.jsxs)("table",{className:"classement-table",children:[(0,a.jsx)("thead",{children:(0,a.jsxs)("tr",{children:[(0,a.jsx)("th",{children:"Rang"})," ",(0,a.jsx)("th",{children:"Club"}),(0,a.jsx)("th",{children:"Pts"}),(0,a.jsx)("th",{children:"MJ"}),(0,a.jsx)("th",{children:"G"}),(0,a.jsx)("th",{children:"N"}),(0,a.jsx)("th",{children:"P"}),(0,a.jsx)("th",{children:"BP"})," ",(0,a.jsx)("th",{children:"BC"})," ",(0,a.jsx)("th",{children:"DB"})," "]})}),(0,a.jsx)("tbody",{children:e.map(((e,t)=>(0,a.jsxs)("tr",{children:[" ",(0,a.jsx)("td",{children:e.rank})," ",(0,a.jsx)("td",{className:"team-column",children:e.teamName}),(0,a.jsx)("td",{className:"points-column",children:e.points}),(0,a.jsx)("td",{children:e.totalGames}),(0,a.jsx)("td",{children:e.wonGames}),(0,a.jsx)("td",{children:e.drawGames}),(0,a.jsx)("td",{children:e.lostGames}),(0,a.jsx)("td",{children:e.goalsFor})," ",(0,a.jsx)("td",{children:e.goalsAgainst})," ",(0,a.jsx)("td",{children:e.goalDifference})," "]},e.teamName)))})]}):(0,a.jsx)("p",{className:"error",children:"Aucun classement disponible pour le moment."})})}}}]);
//# sourceMappingURL=716.6c3eeff6.chunk.js.map