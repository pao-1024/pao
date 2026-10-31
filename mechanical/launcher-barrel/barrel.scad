// =====================================================================
//  弹道筒 / 炮筒  —  pao#61「炮筒改良」
//
//  适配：摩擦轮式 STEAM 发射器（木质底架 100 × 65 mm）
//  安装方式：外扣 —— 扣在现有两块木侧板外面，不拆原结构
//
//  已知实测（来自 issue 图 1 标注）：
//    · 两木侧板净距 = 13 mm      ← 弹道通道的实际内宽
//    · 底板 100 × 65 mm
//    · 木板厚按 3 mm 激光切割板估算，若不同请改 rail_t
//
//  结构：
//    · U 型筒身 —— 底面 / 前端 / 后端三面开口，前口即发射孔
//    · 顶部垂直弹仓 —— 与筒身一体，落弹孔贯穿筒顶壁对准 13 mm 通道
//    · 侧向安装耳 —— 带螺钉孔，固定在底板上
//
//  坐标：
//    x = 沿筒身（0 = 尾端/发射部位，barrel_l = 前端枪口）
//    y = 横向（0 = 通道中心线）
//    z = 垂直（0 = 底板面）
// =====================================================================

$fn = 96;

/* ============ 一、现有木质件实测（按实物改这里） ============ */
rail_gap   = 13;    // 两木侧板净距（图上标注，弹丸走的就是这条缝）
rail_t     = 3;     // 木板厚（激光切割胶合板，常见 3mm）
rail_h     = 20;    // 侧板高度（自底板面往上）

/* 侧向与竖向余量分开给：
   横向必须贴紧 —— 落弹孔(12)要落在 13mm 缝里，两侧各只有 0.5mm 余量，
                   件在板上一晃孔就偏了，所以只留装配间隙。
   竖向可以放宽 —— 顶壁只是盖在侧板上方，不与板顶接触，
                   多留几毫米完全无害，还能吃掉板高误差。 */
clear_side = 0.4;   // 与木板外侧的单边间隙（紧配）
clear_top  = 2.0;   // 顶壁高出侧板顶的量（宽松，防板高偏大顶住）

/* ============ 二、由此推导的内腔（不用手改） ============ */
bore_w = rail_gap + 2 * rail_t + 2 * clear_side;   // 内腔宽，包住两块侧板
bore_h = rail_h + clear_top;                       // 内腔高，顶壁高于侧板顶

/* ============ 三、打印件自身参数 ============ */
wall      = 2.4;    // 壁厚
barrel_l  = 70;     // 筒总长
mag_d     = 12;     // 弹仓内径（必须 < rail_gap，否则落弹孔压到侧板上）
mag_h     = 40;     // 弹仓高出筒顶的高度
mag_x     = 20;     // 弹仓中心距尾端（对准摩擦轮咬入点）
mag_fillet = 2.2;   // 弹仓根部过渡圆角（0 = 关闭）

mount      = true;  // false = 不要安装耳
flange_w   = 9;     // 安装耳外伸宽度
flange_t   = 2.8;   // 安装耳厚度
screw_d    = 2.4;   // 螺钉过孔径（M2.5 自攻）
screw_x    = [12, 58];

/* ============ 派生量 ============ */
outer_w = bore_w + 2 * wall;
outer_h = bore_h + wall;

/* ============ U 型筒身 ============ */
module u_channel() {
    difference() {
        translate([0, -outer_w / 2, 0])
            cube([barrel_l, outer_w, outer_h]);
        // 内腔：底 / 前 / 后三面贯通
        translate([-1, -bore_w / 2, -1])
            cube([barrel_l + 2, bore_w, bore_h + 1]);
    }
}

/* ============ 顶部弹仓 ============ */
module magazine() {
    translate([mag_x, 0, bore_h]) {
        difference() {
            union() {
                cylinder(d = mag_d + 2 * wall, h = mag_h);
                if (mag_fillet > 0)
                    translate([0, 0, -0.01])
                        cylinder(h = mag_fillet + 0.01,
                                 r1 = (mag_d + 2 * wall) / 2 + mag_fillet,
                                 r2 = (mag_d + 2 * wall) / 2);
            }
            translate([0, 0, -1])
                cylinder(d = mag_d, h = mag_h + 2);
        }
    }
}

/* ============ 侧向安装耳 ============ */
module flanges() {
    for (s = [-1, 1]) {
        difference() {
            translate([0, s > 0 ? outer_w / 2 : -outer_w / 2 - flange_w, 0])
                cube([barrel_l, flange_w, flange_t]);
            for (x = screw_x)
                translate([x, s * (outer_w / 2 + flange_w / 2), -1])
                    cylinder(d = screw_d, h = flange_t + 2);
        }
    }
}

/* ============ 总装 ============ */
module part() {
    difference() {
        union() {
            u_channel();
            magazine();
            if (mount) flanges();
        }
        // 落弹孔：贯穿筒顶壁，正对 13mm 通道
        translate([mag_x, 0, bore_h - 0.1])
            cylinder(d = mag_d, h = wall + 1);
    }
}

// 剖视图见 barrel-section.scad（导入 barrel.stl 后切半）
part();
