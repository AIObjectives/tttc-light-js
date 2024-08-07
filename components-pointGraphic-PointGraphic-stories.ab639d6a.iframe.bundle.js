"use strict";(self.webpackChunknext_client=self.webpackChunknext_client||[]).push([[453],{"./src/components/pointGraphic/PointGraphic.stories.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.r(__webpack_exports__),__webpack_require__.d(__webpack_exports__,{Cell:()=>Cell,Main:()=>Main,PointGraphicGroupInteraction:()=>PointGraphicGroupInteraction,__namedExportsOrder:()=>__namedExportsOrder,default:()=>__WEBPACK_DEFAULT_EXPORT__});var _Main_parameters,_Main_parameters_docs,_Main_parameters1,_PointGraphicGroupInteraction_parameters,_PointGraphicGroupInteraction_parameters_docs,_PointGraphicGroupInteraction_parameters1,_Cell_parameters,_Cell_parameters_docs,_Cell_parameters1,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("./node_modules/next/dist/compiled/react/jsx-runtime.js"),stories_data_dummyData__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("./stories/data/dummyData.ts"),react__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("./node_modules/next/dist/compiled/react/index.js"),_PointGraphic__WEBPACK_IMPORTED_MODULE_3__=__webpack_require__("./src/components/pointGraphic/PointGraphic.tsx"),_elements__WEBPACK_IMPORTED_MODULE_4__=__webpack_require__("./src/components/elements/index.ts"),_layout__WEBPACK_IMPORTED_MODULE_5__=__webpack_require__("./src/components/layout/index.ts");const __WEBPACK_DEFAULT_EXPORT__={title:"PointGraphic",component:_PointGraphic__WEBPACK_IMPORTED_MODULE_3__.Ay,parameters:{layout:"center"},tags:["autodocs"],decorators:[Story=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div",{className:"flex h-screen border items-center justify-center",children:(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Story,{})})]},baseProps=stories_data_dummyData__WEBPACK_IMPORTED_MODULE_1__.T.themes[0].topics,Main={args:{claims:baseProps.flatMap((topic=>topic.claims))}};function PointGraphicGroupInteraction(){const[isHighlighted,setIsHighlighted]=(0,react__WEBPACK_IMPORTED_MODULE_2__.useState)(!1);return(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_layout__WEBPACK_IMPORTED_MODULE_5__.f,{gap:5,children:[(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_layout__WEBPACK_IMPORTED_MODULE_5__.y,{className:"gap-x-[3px]",children:[(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_PointGraphic__WEBPACK_IMPORTED_MODULE_3__.gg,{claims:baseProps[0].claims,isHighlighted}),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_PointGraphic__WEBPACK_IMPORTED_MODULE_3__.gg,{claims:baseProps[0].claims,isHighlighted})]}),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_elements__WEBPACK_IMPORTED_MODULE_4__.$n,{onClick:()=>setIsHighlighted((curr=>!curr)),children:"Press Me"})]})}const Cell=()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_PointGraphic__WEBPACK_IMPORTED_MODULE_3__.fh,{claim:baseProps[0].claims[0]});Main.parameters={...Main.parameters,docs:{...null===(_Main_parameters=Main.parameters)||void 0===_Main_parameters?void 0:_Main_parameters.docs,source:{originalSource:"{\n  args: {\n    claims: baseProps.flatMap(topic => topic.claims)\n  }\n}",...null===(_Main_parameters1=Main.parameters)||void 0===_Main_parameters1||null===(_Main_parameters_docs=_Main_parameters1.docs)||void 0===_Main_parameters_docs?void 0:_Main_parameters_docs.source}}},PointGraphicGroupInteraction.parameters={...PointGraphicGroupInteraction.parameters,docs:{...null===(_PointGraphicGroupInteraction_parameters=PointGraphicGroupInteraction.parameters)||void 0===_PointGraphicGroupInteraction_parameters?void 0:_PointGraphicGroupInteraction_parameters.docs,source:{originalSource:'function PointGraphicGroupInteraction() {\n  const [isHighlighted, setIsHighlighted] = useState(false);\n  return <Col gap={5}>\n      <Row className="gap-x-[3px]">\n        <PointGraphicGroup claims={baseProps[0].claims} isHighlighted={isHighlighted} />\n        <PointGraphicGroup claims={baseProps[0].claims} isHighlighted={isHighlighted} />\n      </Row>\n      <Button onClick={() => setIsHighlighted(curr => !curr)}>\n        Press Me\n      </Button>\n    </Col>;\n}',...null===(_PointGraphicGroupInteraction_parameters1=PointGraphicGroupInteraction.parameters)||void 0===_PointGraphicGroupInteraction_parameters1||null===(_PointGraphicGroupInteraction_parameters_docs=_PointGraphicGroupInteraction_parameters1.docs)||void 0===_PointGraphicGroupInteraction_parameters_docs?void 0:_PointGraphicGroupInteraction_parameters_docs.source}}},Cell.parameters={...Cell.parameters,docs:{...null===(_Cell_parameters=Cell.parameters)||void 0===_Cell_parameters?void 0:_Cell_parameters.docs,source:{originalSource:"() => <CellComponent claim={baseProps[0].claims[0]} />",...null===(_Cell_parameters1=Cell.parameters)||void 0===_Cell_parameters1||null===(_Cell_parameters_docs=_Cell_parameters1.docs)||void 0===_Cell_parameters_docs?void 0:_Cell_parameters_docs.source}}};const __namedExportsOrder=["Main","PointGraphicGroupInteraction","Cell"]},"./src/components/pointGraphic/PointGraphic.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{Ay:()=>__WEBPACK_DEFAULT_EXPORT__,fh:()=>Cell,gg:()=>PointGraphicGroup});var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("./node_modules/next/dist/compiled/react/jsx-runtime.js"),react__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("./node_modules/next/dist/compiled/react/index.js"),_elements__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("./src/components/elements/index.ts"),_claim_Claim__WEBPACK_IMPORTED_MODULE_3__=__webpack_require__("./src/components/claim/Claim.tsx"),_layout__WEBPACK_IMPORTED_MODULE_4__=__webpack_require__("./src/components/layout/index.ts");function PointGraphic(param){let{claims}=param;return(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div",{className:"flex flex-row w-full flex-wrap gap-[3px]",children:claims.map(((claim,i)=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Cell,{claim})))})}const PointGraphicGroup=(0,react__WEBPACK_IMPORTED_MODULE_1__.forwardRef)((function PointGraphicGroup(param,ref){let{claims,isHighlighted}=param;return(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div",{className:"flex flex-row gap-[3px]",ref,children:claims.map(((claim,i)=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Cell,{claim,isHighlighted})))})}));function Cell(param,ref){let{claim,isHighlighted}=param;return(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_elements__WEBPACK_IMPORTED_MODULE_2__.jc,{openDelay:0,closeDelay:0,children:[(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_elements__WEBPACK_IMPORTED_MODULE_2__.d0,{children:(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)("div",{className:"w-3 h-3 bg-AOI_graph_cell rounded-sm hover:bg-slate-700 ".concat(isHighlighted?"bg-slate-700":"")})}),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_elements__WEBPACK_IMPORTED_MODULE_2__.Et,{className:"p-4 w-full",children:(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(ClaimCard,{claim})})]})}function ClaimCard(param){let{claim}=param;return(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(_layout__WEBPACK_IMPORTED_MODULE_4__.f,{gap:4,children:[(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_claim_Claim__WEBPACK_IMPORTED_MODULE_3__.yp,{title:claim.title,claimNum:claim.number}),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_layout__WEBPACK_IMPORTED_MODULE_4__.f,{gap:2,children:claim.quotes.map((quote=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_claim_Claim__WEBPACK_IMPORTED_MODULE_3__.UR,{text:quote.text})))})]})}const __WEBPACK_DEFAULT_EXPORT__=PointGraphic;PointGraphicGroup.__docgenInfo={description:"",methods:[],displayName:"PointGraphicGroup",props:{claims:{required:!0,tsType:{name:"Array",elements:[{name:"schema.Claim"}],raw:"schema.Claim[]"},description:""},isHighlighted:{required:!0,tsType:{name:"boolean"},description:""}}},Cell.__docgenInfo={description:"",methods:[],displayName:"Cell",props:{claim:{required:!0,tsType:{name:"schema.Claim"},description:""},isHighlighted:{required:!1,tsType:{name:"boolean"},description:""}}},PointGraphic.__docgenInfo={description:"",methods:[],displayName:"PointGraphic",props:{claims:{required:!0,tsType:{name:"Array",elements:[{name:"schema.Claim"}],raw:"schema.Claim[]"},description:""}}}}}]);