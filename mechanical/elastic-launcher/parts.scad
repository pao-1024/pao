// =====================================================================
//  皮筋储能自动循环发射器 —— 零件模块库
//  include <params.scad> 后调用；本文件自身不产生几何体
// =====================================================================

include <params.scad>
include <gearlib.scad>

/* ---------------------------------------------------------------
   通用：圆角矩形板
   --------------------------------------------------------------- */
module rrect(x0, y0, x1, y1, z0, z1, r) {
    hull()
        for (x = [x0 + r, x1 - r])
            for (y = [y0 + r, y1 - r])
                translate([x, y, z0]) cylinder(r = r, h = z1 - z0);
}

/* ---------------------------------------------------------------
   齿条齿形（梯形近似，模数 m）
   --------------------------------------------------------------- */
module rack_teeth(len, m = 1, t = 2.25, pa = 20) {
    p   = PI * m;
    n   = floor(len / p);
    hw1 = p / 4 + m * tan(pa);   // 齿根半宽
    hw2 = p / 4 - m * tan(pa);   // 齿顶半宽
    for (i = [0 : n - 1])
        translate([i * p, 0, 0])
            linear_extrude(height = t, convexity = 4)
                polygon([[-hw1, 0], [-hw2, t], [hw2, t], [hw1, 0]]);
}

/* ===============================================================
   1. 底板 base-plate
   =============================================================== */
module base_plate() {
    difference() {
        rrect(0, -base_y / 2, base_x, base_y / 2, 0, base_t, corner_r);

        // 滑块导轨槽（两条，限制滑块只能沿 X 滑动）
        for (s = [-1, 1])
            translate([8, s * sled_w / 2, base_t - 2])
                cube([70, 1.6, 4]);

        // 齿轮箱固定孔
        for (x = [28, 58, 88])
            translate([x, 34, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 皮筋锚架固定孔
        for (s = [-1, 1])
            translate([112, s * 20, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 弹道筒固定孔
        for (x = [70, 122])
            for (s = [-1, 1])
                translate([x, s * (bore / 2 + wall / 2), -1])
                    cylinder(d = screw_d, h = base_t + 2);

        // 按钮座孔
        translate([100, -26, -1]) cylinder(d = screw_d, h = base_t + 2);

        // 减重槽
        for (x = [16, 44])
            translate([x, -18, 1.5]) hull() {
                translate([-5, -5, 0]) cylinder(r = 2.5, h = base_t);
                translate([5, -5, 0]) cylinder(r = 2.5, h = base_t);
                translate([-5, 5, 0]) cylinder(r = 2.5, h = base_t);
                translate([5, 5, 0]) cylinder(r = 2.5, h = base_t);
            }
    }
}

/* ===============================================================
   2. 击发滑块 striker（齿条 + 击针 + 皮筋挂钩）
   =============================================================== */
module striker() {
    // 本体
    translate([0, -sled_w / 2, base_t])
        cube([sled_body_l, sled_w, 11]);
    // 齿条：位于本体顶面，长度 = 行程
    translate([4, -sled_w / 2, base_t + 11])
        cube([stroke, sled_w, 1.2]);
    translate([4, -sled_w / 2, base_t + 11])
        rack_teeth(stroke, gear_m, 2.25);
    // 击针
    translate([sled_body_l, 0, base_t + 5])
        rotate([0, 90, 0])
            cylinder(d = rod_d, h = rod_l);
    // 皮筋挂钩（后端）
    translate([-2, 0, base_t + 3])
        rotate([0, 90, 0])
            cylinder(d = 5, h = 4);
}

/* ===============================================================
   3. 弹道筒 barrel（含侧向落弹孔）
   =============================================================== */
module barrel() {
    z0 = base_t;
    difference() {
        // 外形
        translate([barrel_x0, -bore / 2 - wall, z0])
            cube([barrel_x1 - barrel_x0, bore + 2 * wall, barrel_h]);
        // 内腔
        translate([barrel_x0 - 1, -bore / 2, z0 - 1])
            cube([barrel_x1 - barrel_x0 + 2, bore, barrel_h + 1]);
        // 落弹孔（顶部，Ø = 弹丸 + 间隙）
        translate([feed_x, 0, z0 + barrel_h - 1])
            cylinder(d = ball_d + 0.6, h = 4);
        // 弹仓内腔
        translate([feed_x, 0, z0 + barrel_h])
            cylinder(d = ball_d + 0.6, h = mag_h + 1);
    }
    // 弹仓外壁
    difference() {
        translate([feed_x, 0, z0 + barrel_h])
            cylinder(d = ball_d + 0.6 + 2 * wall, h = mag_h);
        translate([feed_x, 0, z0 + barrel_h - 1])
            cylinder(d = ball_d + 0.6, h = mag_h + 2);
    }
}

/* ===============================================================
   4. 齿轮箱 gearbox（电机夹 + 三根轴支撑）
   =============================================================== */
module gearbox() {
    yp = 29;            // 立板起始 Y（在齿轮层之外，避免干涉）
    pt = 5;             // 立板厚

    // 立板 + 三处轴座
    difference() {
        union() {
            translate([8, yp, base_t])
                cube([92, pt, 46]);
            // 轴座凸台
            for (x = [28, 58, 88])
                translate([x, yp - 4, 22])
                    rotate([-90, 0, 0])
                        cylinder(d = 12, h = pt + 4);
            // 电机夹持筒
            translate([88, yp, 22])
                rotate([-90, 0, 0])
                    cylinder(d = motor_d + 6, h = 20);
        }
        // 三个轴承孔
        for (x = [28, 58, 88])
            translate([x, yp - 5, 22])
                rotate([-90, 0, 0])
                    cylinder(d = shaft_d + 0.4, h = pt + 8);
        // 电机腔
        translate([88, yp - 1, 22])
            rotate([-90, 0, 0])
                cylinder(d = motor_d + 0.4, h = 19);
        // 减重
        for (x = [40, 70])
            translate([x, yp - 1, base_t + 10])
                cube([14, pt + 2, 20]);
        // 底板固定孔
        for (x = [28, 58, 88])
            translate([x, yp + 2, base_t - 1])
                cylinder(d = screw_d, h = 8);
    }
}

/* ===============================================================
   5. 皮筋前锚架 band-frame（含击针导套）
   =============================================================== */
module band_frame() {
    difference() {
        union() {
            // 立架（两侧翼，皮筋从 y=±13 走线，避开弹道筒）
            translate([108, -26, base_t])
                cube([6, 52, 26]);
            // 击针导套
            translate([barrel_x0 - 12, 0, base_t + 5])
                rotate([0, 90, 0])
                    cylinder(d = rod_d + 2, h = 12);
        }
        // 皮筋挂槽（y=±13）
        for (s = [-1, 1])
            translate([107, s * 13 - 2, base_t + 16])
                cube([8, 4, 8]);
        // 导套内孔
        translate([barrel_x0 - 13, 0, base_t + 5])
            rotate([0, 90, 0])
                cylinder(d = rod_d + 0.4, h = 14);
        // 底板固定
        for (s = [-1, 1])
            translate([111, s * 20, base_t - 1])
                cylinder(d = screw_d, h = 8);
    }
}

/* ===============================================================
   6. 按钮座 button-mount
   =============================================================== */
module button_mount() {
    difference() {
        union() {
            translate([90, -32, base_t]) cube([20, 14, 4]);
            translate([90, -22, base_t]) cube([20, 4, 16]);
        }
        translate([100, -20, base_t + 9])
            rotate([-90, 0, 0]) cylinder(d = 12.2, h = 6);
        translate([100, -26, base_t - 1]) cylinder(d = screw_d, h = 6);
    }
}
