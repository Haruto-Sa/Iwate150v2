"use client";

import type { ButtonHTMLAttributes, DetailedHTMLProps } from "react";
import "@/components/button/button.css";
import StateLayer from "@/components/state-layer";

/**
 * ボタンバリアント。
 * - primary: 塗り潰し（メインアクション向け）
 * - ghost: テキストのみ（軽いアクション向け）
 * - glass: 半透明背景（ダーク背景上で使用）
 * - outline: 枠線付き（サブアクション向け）
 */
type Variant = "primary" | "ghost" | "glass" | "outline";

/** ボタンサイズ。LiftKit のゴールデンレシオ比率で自動計算される */
type Size = "sm" | "md" | "lg";

type Props = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & {
  variant?: Variant;
  size?: Size;
};

/**
 * プロジェクトバリアントを LiftKit の variant 属性値へ変換する。
 *
 * @param variant - プロジェクトバリアント
 * @returns LiftKit の variant 属性値
 */
function mapLkVariant(variant: Variant): "fill" | "outline" | "text" {
  switch (variant) {
    case "primary":
      return "fill";
    case "outline":
      return "outline";
    case "ghost":
    case "glass":
    default:
      return "text";
  }
}

/**
 * LiftKit ベースの共通ボタンコンポーネント。
 *
 * LiftKit のゴールデンレシオに基づくスペーシング・光学補正パディングを活用しつつ、
 * variant / size / className / children の既存 API 互換を維持する。
 *
 * @param props.variant - ボタンバリアント（primary / ghost / glass / outline）。デフォルト "primary"
 * @param props.size - ボタンサイズ（sm / md / lg）。デフォルト "md"
 * @param props.className - 追加 Tailwind クラス
 * @param props.children - ボタン内容（テキスト・アイコンなどの ReactNode）
 * @returns Button コンポーネント
 * @example
 * <Button variant="primary" size="md">保存する</Button>
 * <Button variant="ghost" size="sm">キャンセル</Button>
 */
export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  disabled,
  type,
  ...rest
}: Props) {
  const lkVariant = mapLkVariant(variant);

  // variant ごとの配色クラス（LiftKit + Tailwind）
  let colorClass = "";
  switch (variant) {
    case "glass":
      colorClass =
        "!bg-white/10 !text-emerald-50 ring-1 ring-white/15 hover:!bg-white/15";
      break;
    case "ghost":
      colorClass = "!bg-transparent !text-[#0f1c1a]";
      break;
    case "outline":
      colorClass = "!bg-transparent !text-emerald-900";
      break;
    case "primary":
    default:
      colorClass = "bg-primary";
      break;
  }

  return (
    <button
      data-lk-component="button"
      data-lk-button-variant={lkVariant}
      data-lk-button-size={size}
      type={type ?? "button"}
      disabled={disabled}
      className={`${colorClass} transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:pointer-events-none disabled:opacity-50 ${className}`}
      {...rest}
    >
      <div data-lk-button-content-wrap="true">{children}</div>
      <StateLayer
        bgColor={
          (variant === "primary" ? "onprimary" : "primary") as LkColor
        }
      />
    </button>
  );
}
