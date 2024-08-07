"use strict";(self.webpackChunknext_client=self.webpackChunknext_client||[]).push([[917],{"./src/components/elements/button/Button.stories.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.r(__webpack_exports__),__webpack_require__.d(__webpack_exports__,{Destructive:()=>Destructive,Disabled:()=>Disabled,Ghost:()=>Ghost,Icon:()=>Icon,Link:()=>Link,Outline:()=>Outline,Primary:()=>Primary,Secondary:()=>Secondary,__namedExportsOrder:()=>__namedExportsOrder,default:()=>__WEBPACK_DEFAULT_EXPORT__});var _Primary_parameters,_Primary_parameters_docs,_Primary_parameters1,_Destructive_parameters,_Destructive_parameters_docs,_Destructive_parameters1,_Secondary_parameters,_Secondary_parameters_docs,_Secondary_parameters1,_Outline_parameters,_Outline_parameters_docs,_Outline_parameters1,_Ghost_parameters,_Ghost_parameters_docs,_Ghost_parameters1,_Link_parameters,_Link_parameters_docs,_Link_parameters1,_Icon_parameters,_Icon_parameters_docs,_Icon_parameters1,_Disabled_parameters,_Disabled_parameters_docs,_Disabled_parameters1,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("./node_modules/next/dist/compiled/react/jsx-runtime.js"),_storybook_test__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("./node_modules/@storybook/test/dist/index.mjs"),_Button__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("./src/components/elements/button/Button.tsx"),_src_assets_icons__WEBPACK_IMPORTED_MODULE_3__=__webpack_require__("./src/assets/icons/index.tsx");const __WEBPACK_DEFAULT_EXPORT__={title:"Button",component:_Button__WEBPACK_IMPORTED_MODULE_2__.$,parameters:{layout:"centered",docs:{description:{component:"NOTES:\nTODO: Add spinner to disabled??\nTODO: Icon + Text Story"}}},tags:["autodocs"],args:{onClick:(0,_storybook_test__WEBPACK_IMPORTED_MODULE_1__.fn)()}},sizes=["lg","default","sm"],enummerateButtonSizes=story=>sizes.map((size=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_Button__WEBPACK_IMPORTED_MODULE_2__.$,{...story.args,size,className:"mx-2"}))),Primary={args:{children:"Primary",variant:"default"}};Primary.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:enummerateButtonSizes(Primary)})];const Destructive={args:{children:"Destructive",variant:"destructive"}};Destructive.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:enummerateButtonSizes(Destructive)})];const Secondary={args:{children:"Secondary",variant:"secondary"}};Secondary.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:enummerateButtonSizes(Secondary)})];const Outline={args:{children:"Outline",variant:"outline"}};Outline.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:enummerateButtonSizes(Outline)})];const Ghost={args:{children:"Ghost",variant:"ghost"}};Ghost.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:enummerateButtonSizes(Ghost)})];const Link={args:{children:"Link",variant:"link"}};Link.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:enummerateButtonSizes(Link)})];const Icon={args:{children:(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_src_assets_icons__WEBPACK_IMPORTED_MODULE_3__.A.Plus,{size:16}),size:"icon",variant:"outline"}};Icon.decorators=[()=>(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsxs)(react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.Fragment,{children:[(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_Button__WEBPACK_IMPORTED_MODULE_2__.$,{...Icon.args,className:"mr-5"}),(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(_Button__WEBPACK_IMPORTED_MODULE_2__.$,{...Icon.args,className:"rounded-full"})]})];const Disabled={args:{children:"Loading",size:"default",disabled:!0}};Primary.parameters={...Primary.parameters,docs:{...null===(_Primary_parameters=Primary.parameters)||void 0===_Primary_parameters?void 0:_Primary_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Primary",\n    variant: "default"\n  }\n}',...null===(_Primary_parameters1=Primary.parameters)||void 0===_Primary_parameters1||null===(_Primary_parameters_docs=_Primary_parameters1.docs)||void 0===_Primary_parameters_docs?void 0:_Primary_parameters_docs.source}}},Destructive.parameters={...Destructive.parameters,docs:{...null===(_Destructive_parameters=Destructive.parameters)||void 0===_Destructive_parameters?void 0:_Destructive_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Destructive",\n    variant: "destructive"\n  }\n}',...null===(_Destructive_parameters1=Destructive.parameters)||void 0===_Destructive_parameters1||null===(_Destructive_parameters_docs=_Destructive_parameters1.docs)||void 0===_Destructive_parameters_docs?void 0:_Destructive_parameters_docs.source}}},Secondary.parameters={...Secondary.parameters,docs:{...null===(_Secondary_parameters=Secondary.parameters)||void 0===_Secondary_parameters?void 0:_Secondary_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Secondary",\n    variant: "secondary"\n  }\n}',...null===(_Secondary_parameters1=Secondary.parameters)||void 0===_Secondary_parameters1||null===(_Secondary_parameters_docs=_Secondary_parameters1.docs)||void 0===_Secondary_parameters_docs?void 0:_Secondary_parameters_docs.source}}},Outline.parameters={...Outline.parameters,docs:{...null===(_Outline_parameters=Outline.parameters)||void 0===_Outline_parameters?void 0:_Outline_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Outline",\n    variant: "outline"\n  }\n}',...null===(_Outline_parameters1=Outline.parameters)||void 0===_Outline_parameters1||null===(_Outline_parameters_docs=_Outline_parameters1.docs)||void 0===_Outline_parameters_docs?void 0:_Outline_parameters_docs.source}}},Ghost.parameters={...Ghost.parameters,docs:{...null===(_Ghost_parameters=Ghost.parameters)||void 0===_Ghost_parameters?void 0:_Ghost_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Ghost",\n    variant: "ghost"\n  }\n}',...null===(_Ghost_parameters1=Ghost.parameters)||void 0===_Ghost_parameters1||null===(_Ghost_parameters_docs=_Ghost_parameters1.docs)||void 0===_Ghost_parameters_docs?void 0:_Ghost_parameters_docs.source}}},Link.parameters={...Link.parameters,docs:{...null===(_Link_parameters=Link.parameters)||void 0===_Link_parameters?void 0:_Link_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Link",\n    variant: "link"\n  }\n}',...null===(_Link_parameters1=Link.parameters)||void 0===_Link_parameters1||null===(_Link_parameters_docs=_Link_parameters1.docs)||void 0===_Link_parameters_docs?void 0:_Link_parameters_docs.source}}},Icon.parameters={...Icon.parameters,docs:{...null===(_Icon_parameters=Icon.parameters)||void 0===_Icon_parameters?void 0:_Icon_parameters.docs,source:{originalSource:'{\n  args: {\n    children: <Icons.Plus size={16} />,\n    size: "icon",\n    variant: "outline"\n  }\n}',...null===(_Icon_parameters1=Icon.parameters)||void 0===_Icon_parameters1||null===(_Icon_parameters_docs=_Icon_parameters1.docs)||void 0===_Icon_parameters_docs?void 0:_Icon_parameters_docs.source}}},Disabled.parameters={...Disabled.parameters,docs:{...null===(_Disabled_parameters=Disabled.parameters)||void 0===_Disabled_parameters?void 0:_Disabled_parameters.docs,source:{originalSource:'{\n  args: {\n    children: "Loading",\n    size: "default",\n    disabled: true\n  }\n}',...null===(_Disabled_parameters1=Disabled.parameters)||void 0===_Disabled_parameters1||null===(_Disabled_parameters_docs=_Disabled_parameters1.docs)||void 0===_Disabled_parameters_docs?void 0:_Disabled_parameters_docs.source}}};const __namedExportsOrder=["Primary","Destructive","Secondary","Outline","Ghost","Link","Icon","Disabled"]},"./src/assets/icons/index.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{A:()=>icons});var jsx_runtime=__webpack_require__("./node_modules/next/dist/compiled/react/jsx-runtime.js"),icons_link=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/link.js"),plus=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/plus.js"),minus=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/minus.js"),book_text=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/book-text.js"),circle_user_round=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/circle-user-round.js"),calendar=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/calendar.js"),arrow_up_down=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/arrow-up-down.js"),github=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/github.js"),menu=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/menu.js"),circle_check_big=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/circle-check-big.js"),align_left=__webpack_require__("./node_modules/lucide-react/dist/esm/icons/align-left.js");const Topic={src:"static/media/Topic.b5ca946c.svg",height:16,width:17,blurDataURL:"static/media/Topic.b5ca946c.svg"},quote_aoi={src:"static/media/quote aoi.d26923f9.svg",height:26,width:16,blurDataURL:"static/media/quote aoi.d26923f9.svg"},Claim={src:"static/media/Claim.1a66c1ce.svg",height:16,width:17,blurDataURL:"static/media/Claim.1a66c1ce.svg"},ChevronRight={src:"static/media/ChevronRight.a2fb8e1a.svg",height:24,width:24,blurDataURL:"static/media/ChevronRight.a2fb8e1a.svg"};var next_image=__webpack_require__("./node_modules/@storybook/nextjs/dist/images/next-image.mjs");const Icons=()=>(0,jsx_runtime.jsx)(jsx_runtime.Fragment,{}),Copy=icons_link.A;Icons.Copy=Copy,Icons.Plus=plus.A,Icons.Minus=minus.A,Icons.Theme=book_text.A,Icons.People=circle_user_round.A,Icons.Date=calendar.A,Icons.Select=arrow_up_down.A,Icons.Github=github.A,Icons.Menu=menu.A,Icons.Success=circle_check_big.A,Icons.Outline=align_left.A,Icons.ChevronRight=props=>(0,jsx_runtime.jsx)(next_image.A,{...props,src:ChevronRight,alt:"chevron icon"}),Icons.Topic=props=>(0,jsx_runtime.jsx)(next_image.A,{...props,src:Topic,alt:"topic icon"}),Icons.Quote=props=>(0,jsx_runtime.jsx)(next_image.A,{...props,src:quote_aoi,alt:"topic icon"}),Icons.Claim=props=>(0,jsx_runtime.jsx)(next_image.A,{...props,src:Claim,alt:"topic icon"});const icons=Icons;Icons.__docgenInfo={description:"",methods:[{name:"ChevronRight",docblock:null,modifiers:["static"],params:[{name:"props",optional:!1,type:{name:"signature",type:"object",raw:"{ className?: string }",signature:{properties:[{key:"className",value:{name:"string",required:!1}}]}}}],returns:null},{name:"Topic",docblock:null,modifiers:["static"],params:[{name:"props",optional:!1,type:{name:"signature",type:"object",raw:"{ className?: string }",signature:{properties:[{key:"className",value:{name:"string",required:!1}}]}}}],returns:null},{name:"Quote",docblock:null,modifiers:["static"],params:[{name:"props",optional:!1,type:{name:"signature",type:"object",raw:"{ className?: string }",signature:{properties:[{key:"className",value:{name:"string",required:!1}}]}}}],returns:null},{name:"Claim",docblock:null,modifiers:["static"],params:[{name:"props",optional:!1,type:{name:"signature",type:"object",raw:"{ className?: string }",signature:{properties:[{key:"className",value:{name:"string",required:!1}}]}}}],returns:null}],displayName:"Icons"}},"./src/components/elements/button/Button.tsx":(__unused_webpack_module,__webpack_exports__,__webpack_require__)=>{__webpack_require__.d(__webpack_exports__,{$:()=>Button});var react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__=__webpack_require__("./node_modules/next/dist/compiled/react/jsx-runtime.js"),react__WEBPACK_IMPORTED_MODULE_1__=__webpack_require__("./node_modules/next/dist/compiled/react/index.js"),_radix_ui_react_slot__WEBPACK_IMPORTED_MODULE_3__=__webpack_require__("./node_modules/@radix-ui/react-slot/dist/index.mjs"),class_variance_authority__WEBPACK_IMPORTED_MODULE_2__=__webpack_require__("./node_modules/class-variance-authority/dist/index.mjs"),_utils_shadcn__WEBPACK_IMPORTED_MODULE_4__=__webpack_require__("./src/lib/utils/shadcn.ts");const buttonVariants=(0,class_variance_authority__WEBPACK_IMPORTED_MODULE_2__.F)("inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:opacity-75",{variants:{variant:{default:"bg-primary text-primary-foreground hover:bg-primary/90",destructive:"bg-destructive text-destructive-foreground hover:bg-destructive/90",outline:"border border-input bg-background hover:bg-accent hover:text-accent-foreground",secondary:"bg-secondary text-secondary-foreground hover:bg-secondary/80",ghost:"hover:bg-accent hover:text-accent-foreground",link:"text-primary underline-offset-4 hover:underline"},size:{default:"h-10 px-4 py-2",sm:"h-9 rounded-md px-3",lg:"h-11 rounded-md px-8",icon:"h-10 w-10 p-3"}},defaultVariants:{variant:"default",size:"default"}}),Button=react__WEBPACK_IMPORTED_MODULE_1__.forwardRef(((param,ref)=>{let{className,variant,size,asChild=!1,...props}=param;const Comp=asChild?_radix_ui_react_slot__WEBPACK_IMPORTED_MODULE_3__.DX:"button";return(0,react_jsx_runtime__WEBPACK_IMPORTED_MODULE_0__.jsx)(Comp,{className:(0,_utils_shadcn__WEBPACK_IMPORTED_MODULE_4__.cn)(buttonVariants({variant,size,className})),ref,...props})}));Button.displayName="Button",Button.__docgenInfo={description:"",methods:[],displayName:"Button",props:{asChild:{defaultValue:{value:"false",computed:!1},required:!1}}}}}]);