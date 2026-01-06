import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'en' | 'zh';

const translations = {
  en: {
    "app.title": "GraphFlow",
    "app.subtitle": "Manage and visualize your node graphs.",
    "dashboard.pinned": "Pinned",
    "dashboard.other_graphs": "Other Graphs",
    "dashboard.all_graphs": "All Graphs",
    "dashboard.create_new": "Create New Graph",
    "project.unpin": "Unpin",
    "project.pin": "Pin to top",
    "project.delete": "Delete",
    "project.confirm_delete": "Confirm",
    "project.click_to_confirm": "Click again to confirm delete",
    "project.new_name": "New Project",
    "editor.back": "Back",
    "editor.project_name_placeholder": "Project Name",
    "editor.node": "Node",
    "editor.link_mode": "Link Mode",
    "editor.link_activated": "LINK ACTIVATED",
    "editor.director_mode": "Director Mode",
    "editor.save": "Save",
    "editor.saving": "Saving...",
    "editor.saved": "Saved",
    "editor.dev_mode": "Dev Mode",
    "devtools.title": "Developer Tools",
    "devtools.topology": "Graph Topology",
    "devtools.reset": "Reset",
    "devtools.apply": "Apply",
    "devtools.theme": "Visual Theme",
    "devtools.apply_theme": "Apply Theme",
    "devtools.color_hint": "Click color swatches in the gutter to edit.",
    "devtools.script": "Animation Script",
    "devtools.update": "Update",
    "devtools.run": "Run",
    "devtools.run_simulation": "Run Simulation",
    "director.title": "Director Studio",
    "director.subtitle": "DIRECTOR STUDIO v2.4",
    "director.config_title": "Default Action Config",
    "director.link_style": "Default Link Style",
    "director.none_default": "(None/Default)",
    "director.target_state": "Default Impact",
    "director.processing_state": "Default Processing",
    "director.final_state": "Default Final",
    "director.none_skip": "(None/Skip)",
    "director.none_no_change": "(None/No Change)",
    "director.init_states": "Initial States",
    "director.timeline": "Script Timeline",
    "director.parallel_group": "Parallel Group",
    "director.group_label": "Group Label",
    "director.add_step_group": "Add Step to Group",
    "director.empty_group": "Empty group, click + above to add",
    "director.add_step": "Add Step",
    "director.add_step_continuous": "Add Continuous",
    "director.add_parallel": "Add Parallel",
    "director.full_rehearsal": "Full Rehearsal",
    "director.commit": "Commit Publish",
    "director.production_ready": "PRODUCTION READY",
    "director.draft_unsynced": "Draft Unsynced",
    "director.locked": "Locked",
    "director.step.atomic": "Atomic Step",
    "director.step.preview": "Preview Step",
    "director.step.from": "FROM",
    "director.step.to": "TO",
    "director.step.label_placeholder": "Action Label (e.g. 'Processing Data')",
    "director.step.default_link": "Default Link",
    "director.step.impact_none": "Impact: None",
    "director.step.processing_none": "Processing: None",
    "director.step.final_none": "Final: None",
    "director.step.dur": "Dur",
    "controls.del": "Delete Node/Link",
    "controls.enter": "Confirm Action",
    "controls.esc": "Cancel Selection",
    "overlay.step1": "🎬 Step 1: Pick Source Node",
    "overlay.step2": "🎬 Step 2: Pick Target Node",
    "overlay.cancel": "Esc Cancel",
    "overlay.click_target": "Click target to connect",
    "overlay.select_source": "Select source to link",
    "context.custom_color": "Custom Color",
    "context.create_link": "Create Link (L)",
    "context.edit_meta": "Edit Metadata",
    "context.delete": "Delete (Del)",
    "context.confirm": "Confirm",
    "context.cancel": "Cancel (Esc)",
    "context.meta_title": "Meta Data (meta_data)",
    "context.key": "key",
    "context.value": "value"
  },
  "zh": {
    "app.title": "GraphFlow",
    "app.subtitle": "管理和可视化您的节点图。",
    "dashboard.pinned": "已置顶",
    "dashboard.other_graphs": "其他图表",
    "dashboard.all_graphs": "所有图表",
    "dashboard.create_new": "新建图表",
    "project.unpin": "取消置顶",
    "project.pin": "置顶",
    "project.delete": "删除",
    "project.confirm_delete": "确认",
    "project.click_to_confirm": "再次点击以确认删除",
    "project.new_name": "新项目",
    "editor.back": "返回",
    "editor.project_name_placeholder": "项目名称",
    "editor.node": "节点",
    "editor.link_mode": "连线模式",
    "editor.link_activated": "连线已激活",
    "editor.director_mode": "导演模式",
    "editor.save": "保存",
    "editor.saving": "保存中...",
    "editor.saved": "已保存",
    "editor.dev_mode": "开发者模式",
    "devtools.title": "开发者工具",
    "devtools.topology": "图结构 (Topology)",
    "devtools.reset": "重置",
    "devtools.apply": "应用",
    "devtools.theme": "视觉主题",
    "devtools.apply_theme": "应用主题",
    "devtools.color_hint": "点击行号旁的色块可直接编辑颜色。",
    "devtools.script": "动画脚本",
    "devtools.update": "更新",
    "devtools.run": "运行",
    "devtools.run_simulation": "运行模拟",
    "director.title": "导演工作台",
    "director.subtitle": "DIRECTOR STUDIO v2.4",
    "director.config_title": "默认动作配置",
    "director.link_style": "默认连线样式",
    "director.none_default": "(无/默认)",
    "director.target_state": "默认目标状态 (Impact)",
    "director.processing_state": "默认处理状态 (Processing)",
    "director.final_state": "默认结尾状态 (Final)",
    "director.none_skip": "(无/跳过)",
    "director.none_no_change": "(无/不改变)",
    "director.init_states": "初始状态设置",
    "director.timeline": "剧本时间轴",
    "director.parallel_group": "并行组",
    "director.group_label": "组标签",
    "director.add_step_group": "添加动作到组",
    "director.empty_group": "组内暂无动作，点击上方 + 添加",
    "director.add_step": "新增单步",
    "director.add_step_continuous": "连续新增",
    "director.add_parallel": "新增并行",
    "director.full_rehearsal": "全剧试演",
    "director.commit": "提交发布",
    "director.production_ready": "PRODUCTION READY",
    "director.draft_unsynced": "草稿未同步",
    "director.locked": "已锁定",
    "director.step.atomic": "单步动作",
    "director.step.preview": "预览动作",
    "director.step.from": "起点",
    "director.step.to": "终点",
    "director.step.label_placeholder": "动作标签 (如 '数据处理中')",
    "director.step.default_link": "默认连线",
    "director.step.impact_none": "Impact: 无",
    "director.step.processing_none": "Processing: 无",
    "director.step.final_none": "Final: 无",
    "director.step.dur": "时长",
    "controls.del": "删除 节点/连线",
    "controls.enter": "确认操作",
    "controls.esc": "取消选择",
    "overlay.step1": "🎬 第一步：点击选择起点节点",
    "overlay.step2": "🎬 第二步：点击选择终点节点",
    "overlay.cancel": "Esc 取消",
    "overlay.click_target": "点击目标节点以连接",
    "overlay.select_source": "选择源节点开始连线",
    "context.custom_color": "自定义颜色",
    "context.create_link": "创建连接 (L)",
    "context.edit_meta": "编辑元数据",
    "context.delete": "删除 (Del)",
    "context.confirm": "确认",
    "context.cancel": "取消 (Esc)",
    "context.meta_title": "元数据 (meta_data)",
    "context.key": "键",
    "context.value": "值"
  }
};

type Translations = typeof translations.en;

const I18nContext = createContext<{
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof Translations) => string;
}>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
});

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    // Detect browser language
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('zh')) {
      setLanguage('zh');
    } else {
      setLanguage('en');
    }
  }, []);

  const t = (key: keyof Translations) => {
    return translations[language][key] || key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
