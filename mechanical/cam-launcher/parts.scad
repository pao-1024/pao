// =====================================================================
//  零件模块库 —— 完全按卖家结构（单轴同心 / 销子推凸台 / 皮筋击发）
// =====================================================================

include <params.scad>

module rrect(x0, y0, x1, y1, z0, z1, r) {
    hull()
        for (x = [x0 + r, x1 - r])
            for (y = [y0 + r, y1 - r])
                translate([x, y, z0]) cylinder(r = r, h = z1 - z0);
}

/* ===============================================================
   1. 底板
   =============================================================== */
module base_plate() {
    difference() {
        rrect(0, -base_y / 2, base_x, base_y / 2, 0, base_t, corner_r);

        // 电机座固定孔
        for (x = [P_x - 15, P_x + 15])
            for (y = [motor_y0 + 8, motor_y1 - 8])
                translate([x, y, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 前段导轨固定孔
        for (x = [78, 88])
            for (s = [-1, 1])
                translate([x, Y_L + s * (rail_gap / 2 + wall / 2), -1])
                    cylinder(d = screw_d, h = base_t + 2);

        // 弹道筒固定孔
        for (x = [96, 144])
            for (s = [-1, 1])
                translate([x, Y_L + s * (rail_gap / 2 + wall / 2), -1])
                    cylinder(d = screw_d, h = base_t + 2);

        // 皮筋锚柱
        translate([anchor_x, Y_L, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 按钮
        translate([126, Y_L - 26, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 减重槽
        for (x = [24, 42])
            translate([x, Y_L, 1.5]) hull() {
                translate([-5, -5, 0]) cylinder(r = 2.5, h = base_t);
                translate([5, -5, 0]) cylinder(r = 2.5, h = base_t);
                translate([-5, 5, 0]) cylinder(r = 2.5, h = base_t);
                translate([5, 5, 0]) cylinder(r = 2.5, h = base_t);
            }
    }
}

/* ===============================================================
   2. TT 电机座（同轴，圆板在 -Y 端）
   =============================================================== */
module motor_cradle() {
    wt = 3;
    z0 = base_t;
    z1 = base_t + motor_h;
    x0 = P_x - motor_w / 2 - wt;
    x1 = P_x + motor_w / 2 + wt;

    difference() {
        union() {
            // U 形槽
            translate([x0, motor_y0 - wt, z0])
                cube([x1 - x0, motor_l + 2 * wt, z1 - z0]);
            // 前后挡边（轴向限位）
            translate([x0, motor_y0 - wt, z0])
                cube([x1 - x0, wt, z1 - z0 + 8]);
            translate([x0, motor_y1 + wt - wt, z0])
                cube([x1 - x0, wt, z1 - z0 + 8]);
        }
        // 电机腔
        translate([P_x - motor_w/2, motor_y0 - 1, z0 + wt])
            cube([motor_w, motor_l + 2, motor_h + 2]);
        // 出轴让位（-Y 端，轴要穿过圆板）
        translate([P_x, motor_y0 - 12, P_z])
            rotate([-90, 0, 0])
                cylinder(d = motor_shaft_d + 4, h = 16);
        // 底部固定孔
        for (x = [P_x - 15, P_x + 15])
            for (y = [motor_y0 + 8, motor_y1 - 8])
                translate([x, y, z0 - 1]) cylinder(d = screw_d, h = wt + 3);
    }
}

/* ===============================================================
   3. 圆板 striker-plate（卖家那块白色板）
      含：盘体 + 背部凸台 + 前部打击臂 + 皮筋挂耳 + 中心轴孔
   =============================================================== */
module striker_plate() {
    // 2D 轮廓在 XY 平面画，rotate 后 2D 的 y 变成 3D 的 z
    rotate([90, 0, 0])
        linear_extrude(height = plate_t, center = true)
            union() {
                circle(r = plate_r);
                // 背部凸台（朝 +X 偏上）
                polygon([
                    [lobe_r0 * cos(lobe_ang - lobe_w), lobe_r0 * sin(lobe_ang - lobe_w)],
                    [lobe_r1 * cos(lobe_ang - lobe_w), lobe_r1 * sin(lobe_ang - lobe_w)],
                    [lobe_r1 * cos(lobe_ang + lobe_w), lobe_r1 * sin(lobe_ang + lobe_w)],
                    [lobe_r0 * cos(lobe_ang + lobe_w), lobe_r0 * sin(lobe_ang + lobe_w)],
                ]);
                // 打击臂
                polygon([
                    [0, 0],
                    [arm_r * cos(-arm_ang - 4.5/arm_r), arm_r * sin(-arm_ang - 4.5/arm_r)],
                    [arm_r * cos(-arm_ang + 4.5/arm_r), arm_r * sin(-arm_ang + 4.5/arm_r)],
                ]);
            }

    // 打击块（臂端加厚）
    translate([arm_r * cos(-arm_ang), 0, arm_r * sin(-arm_ang)])
        cube([7, plate_t + 2, 9], center = true);

    // 皮筋挂耳
    translate([-9, 0, 8])
        rotate([90, 0, 0])
            cylinder(d = 4, h = plate_t + 6, center = true);

    // 中心轴孔（后加工：打印后再钻，或直接留孔）
    translate([0, 0, 0])
        rotate([90, 0, 0])
            cylinder(d = motor_shaft_d + 0.2, h = plate_t + 4, center = true);
}

/* ===============================================================
   4. 销子套 pin-collar（套在电机轴上，带一个凸销）
   =============================================================== */
module pin_collar() {
    difference() {
        union() {
            // 套筒
            cylinder(d = motor_shaft_d + 6, h = post_t);
            // 销子
            translate([post_r, 0, 0])
                cylinder(d = post_d, h = post_t);
        }
        // 轴孔 + 紧定
        translate([0, 0, -1])
            cylinder(d = motor_shaft_d + 0.15, h = post_t + 2);
        // D 形扁位
        translate([motor_shaft_d/2 - 0.9, -motor_shaft_d/2 - 1, -1])
            cube([3, motor_shaft_d + 2, post_t + 2]);
        // 夹紧缝
        translate([-motor_shaft_d/2 - 4, -0.8, -1])
            cube([4, 1.6, post_t + 2]);
    }
}

/* ===============================================================
   5. 前段导轨（敞开通道，打击臂从这里进入）
   =============================================================== */
module front_rail() {
    for (s = [-1, 1])
        translate([rail_x0, Y_L + (s > 0 ? rail_gap/2 : -rail_gap/2 - wall), base_t])
            cube([rail_x1 - rail_x0, wall, 14]);
}

/* ===============================================================
   6. 弹道筒 + 弹仓
   =============================================================== */
module barrel() {
    difference() {
        // 外廓
        translate([barrel_x0, Y_L - rail_gap/2 - wall, base_t])
            cube([barrel_x1 - barrel_x0, rail_gap + 2*wall, barrel_h]);
        // 内腔（前后贯通，留 3mm 顶壁）
        translate([barrel_x0 - 1, Y_L - rail_gap/2, base_t - 1])
            cube([barrel_x1 - barrel_x0 + 2, rail_gap, barrel_h - 3 + 1]);
    }
}

/* ===============================================================
   6b. 弹仓（立在敞开段上方，坐在两侧导轨顶面）
   =============================================================== */
module magazine() {
    z0 = base_t + rail_h;      // 坐在导轨顶面
    od = ball_d + 2*wall;      // 管外径
    difference() {
        union() {
            cylinder(d = od + 5, h = 5);                    // 底部法兰（跨在导轨上）
            translate([0, 0, 0]) cylinder(d = od, h = mag_h); // 管身
            translate([0, 0, mag_h - 4]) cylinder(d = od + 4, h = 4); // 顶部加强环
        }
        translate([0, 0, -1]) cylinder(d = ball_d + 0.6, h = mag_h + 6);
        // 清堵观察窗
        translate([od/2 - 1, 0, mag_h*0.55]) cube([5, 5, 9], center = true);
    }
}

/* ===============================================================
   7. 皮筋锚柱
   =============================================================== */
module band_anchor() {
    difference() {
        union() {
            translate([anchor_x - 5, Y_L - 8, base_t]) cube([10, 16, 6]);
            translate([anchor_x - 3, Y_L - 3, base_t + 6])
                cylinder(d = 6, h = anchor_z - base_t - 6);
            translate([anchor_x - 8, Y_L - 4, anchor_z - 6]) cube([16, 8, 6]);
        }
        translate([anchor_x, Y_L, base_t - 1]) cylinder(d = screw_d, h = 8);
        for (s = [-1, 1])
            translate([anchor_x, Y_L + s*4, anchor_z - 7])
                rotate([90, 0, 0]) cylinder(d = 3, h = 10, center = true);
    }
}

/* ===============================================================
   8. 按钮座
   =============================================================== */
module button_mount() {
    difference() {
        union() {
            translate([116, Y_L - 32, base_t]) cube([20, 14, 4]);
            translate([116, Y_L - 22, base_t]) cube([20, 4, 16]);
        }
        translate([126, Y_L - 20, base_t + 9])
            rotate([-90, 0, 0]) cylinder(d = 12.2, h = 6);
        translate([126, Y_L - 26, base_t - 1]) cylinder(d = screw_d, h = 6);
    }
}
