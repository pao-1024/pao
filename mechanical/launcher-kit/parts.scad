// =====================================================================
//  PAO 发射器 —— 全部零件模块库
//  include <params.scad> 后调用下列 module；本文件自身不产生几何体
// =====================================================================

include <params.scad>

/* ---------------------------------------------------------------
   通用：圆角矩形板
   --------------------------------------------------------------- */
module rrect_plate(x0, y0, x1, y1, z0, z1, r) {
    hull()
        for (x = [x0 + r, x1 - r])
            for (y = [y0 + r, y1 - r])
                translate([x, y, z0]) cylinder(r = r, h = z1 - z0);
}

/* ---------------------------------------------------------------
   送弹斜坡：靠重力把弹丸送进轮下咬入区
   --------------------------------------------------------------- */
module feed_ramp() {
    hull() {
        translate([ramp_x0, -rail_gap / 2, base_t])
            cube([0.1, rail_gap, ramp_h]);
        translate([ramp_x1, -rail_gap / 2, base_t])
            cube([0.1, rail_gap, 0.1]);
    }
}

/* ===============================================================
   1. 底板 base-plate
   =============================================================== */
module base_plate() {
    difference() {
        union() {
            rrect_plate(0, -base_y / 2, base_x, base_y / 2, 0, base_t, corner_r);
            feed_ramp();
        }

        // 四角安装孔
        for (x = [10, base_x - 12])
            for (y = [-base_y / 2 + 10, base_y / 2 - 10])
                translate([x, y, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 弹道筒固定孔（落在筒壁正下方）
        for (x = [16, 90])
            for (s = [-1, 1])
                translate([x, s * (rail_gap / 2 + bar_wall / 2), -1])
                    cylinder(d = screw_d, h = base_t + 2);

        // 驱动支架固定孔
        for (x = [fw_x - 10, fw_x + 10])
            translate([x, br_y + 14, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 按钮座固定孔
        translate([sw_mount_x, sw_mount_y, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 底面减重槽
        for (x = [42, 64, 84])
            translate([x, 0, 1.5]) hull() {
                translate([-6, -15, 0]) cylinder(r = 3, h = base_t);
                translate([6, -15, 0]) cylinder(r = 3, h = base_t);
                translate([-6, 15, 0]) cylinder(r = 3, h = base_t);
                translate([6, 15, 0]) cylinder(r = 3, h = base_t);
            }
    }
}

/* ===============================================================
   2. 弹道筒 + 弹仓喉部 barrel
   · 侧壁贯穿全长
   · 后段（bar_x0..throat_x1）加高成喉部，即弹仓
   · 前段（throat_x1..bar_x1）加盖成封闭弹道
   · 侧壁开轴孔让轮轴穿过
   =============================================================== */
module barrel() {
    z0 = base_t;

    module walls() {
        for (s = [-1, 1]) {
            y = s > 0 ? rail_gap / 2 : -rail_gap / 2 - bar_wall;
            // 基本侧壁（全长）
            translate([bar_x0, y, z0])
                cube([bar_x1 - bar_x0, bar_wall, wall_top]);
            // 喉部加高段
            translate([bar_x0, y, z0])
                cube([throat_x1 - bar_x0, bar_wall, throat_h]);
        }
        // 后端封板
        translate([bar_x0, -rail_gap / 2 - bar_wall, z0])
            cube([bar_wall, rail_gap + 2 * bar_wall, throat_h]);
    }

    module front_lid() {
        translate([throat_x1, -rail_gap / 2 - bar_wall, z0 + wall_top])
            cube([bar_x1 - throat_x1, rail_gap + 2 * bar_wall, bar_top_h]);
    }

    difference() {
        union() {
            walls();
            front_lid();
        }
        // 轴过孔（贯穿两侧壁）
        for (s = [-1, 1])
            translate([fw_x, s * (rail_gap / 2 + bar_wall + 1), fw_zc])
                rotate([90, 0, 0])
                    cylinder(d = shaft_d + 0.5, h = 2 * (bar_wall + 1));
    }
}

/* ===============================================================
   3. 摩擦轮 flywheel
   =============================================================== */
module flywheel() {
    difference() {
        union() {
            cylinder(r = fw_r, h = fw_t, center = true);
            cylinder(r = fw_r * 0.38, h = fw_t + 4, center = true);
        }
        cylinder(d = shaft_d + 0.15, h = fw_t + 6, center = true);
        // 轮缘环槽
        rotate_extrude(convexity = 4)
            translate([fw_r - 0.5, 0, 0]) circle(d = 1.6);
        // 减重孔
        for (a = [0 : 60 : 359])
            rotate([0, 0, a]) translate([fw_r * 0.68, 0, 0])
                cylinder(d = fw_r * 0.3, h = fw_t + 6, center = true);
    }
}

/* ===============================================================
   4. 驱动支架 drive-bracket
   立板 + 电机夹持筒 + 底板脚
   =============================================================== */
module drive_bracket() {
    difference() {
        union() {
            // 底板脚
            translate([fw_x - 16, br_y, base_t])
                cube([34, 20, 5]);
            // 立板
            translate([fw_x - 16, br_y, base_t])
                cube([34, br_wall, fw_zc + fw_r - base_t]);
            // 电机夹持筒
            translate([fw_x, br_y + br_wall, fw_zc])
                rotate([-90, 0, 0])
                    cylinder(d = motor_d + 6, h = motor_clamp_l);
        }
        // 轴过孔
        translate([fw_x, br_y - 1, fw_zc])
            rotate([-90, 0, 0])
                cylinder(d = shaft_d + 0.4, h = br_wall + 2);
        // 电机腔
        translate([fw_x, br_y + br_wall - 0.5, fw_zc])
            rotate([-90, 0, 0])
                cylinder(d = motor_d + 0.4, h = motor_clamp_l - 1);
        // 夹紧缝
        translate([fw_x, br_y + br_wall + motor_clamp_l / 2, fw_zc + motor_d / 2])
            cube([1.6, motor_clamp_l, 8], center = true);
        // 脚部螺钉孔
        for (x = [fw_x - 10, fw_x + 10])
            translate([x, br_y + 14, base_t - 1])
                cylinder(d = screw_d, h = 8);
    }
}

/* ===============================================================
   5. 按钮座 button-mount
   =============================================================== */
module button_mount() {
    w = 22; d = 16; t = 4; wall_h = 16;

    difference() {
        union() {
            translate([sw_mount_x - w / 2, sw_mount_y - d / 2, base_t])
                cube([w, d, t]);
            translate([sw_mount_x - w / 2, sw_mount_y + d / 2 - t, base_t])
                cube([w, t, wall_h]);
        }
        // 开关孔（轴向 Y）
        translate([sw_mount_x, sw_mount_y + d / 2 - t - 1, base_t + wall_h * 0.55])
            rotate([-90, 0, 0])
                cylinder(d = sw_d, h = t + 2);
        // 底板固定孔
        translate([sw_mount_x, sw_mount_y, base_t - 1])
            cylinder(d = screw_d, h = t + 2);
    }
}
