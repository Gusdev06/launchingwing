"use client";
import {createContext,useContext,type ReactNode} from "react";
import type {PilotRun} from "@/lib/pilot-model";
import type {Content,View,WorkspaceData} from "./model";
export type WorkspaceContext={data:WorkspaceData;contents:Content[];run?:PilotRun|null;view:View;selectedId:string;setSelectedId:(id:string)=>void;navigate:(view:View,id?:string)=>void;commit:(fn:(data:WorkspaceData)=>WorkspaceData,message?:string)=>Promise<boolean>;notify:(message:string)=>void;ready:boolean;setDirty:(dirty:boolean)=>void;renderPilotEditor?:(id:string,close:()=>void)=>ReactNode;downloadApproved?:()=>void};
export const Context=createContext<WorkspaceContext|null>(null);
export function useWorkspace(){const ctx=useContext(Context);if(!ctx)throw new Error('Workspace provider missing');return ctx}
