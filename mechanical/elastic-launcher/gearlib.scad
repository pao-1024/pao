// =====================================================================
//  齿轮生成器（梯形齿廓，3D 布尔并集）
//
//  为什么不用渐开线 + 2D 并集：
//    渐开线齿廓拼成单一闭合多边形时，齿根圆弧与相邻齿面在端点处重合，
//    OpenSCAD 的 2D 三角化会产生自交/退化面，挤出后网格不封闭。
//
//  这里改为：根圆柱 + 逐个梯形齿块，齿块底部径向内嵌到 rf−0.6，
//  形成**体积重叠**而非面接触，布尔并集稳定，导出必为封闭流形。
//
//  齿廓用直线代替渐开线：对 3D 打印的玩具齿轮（低速、轻载）精度足够，
//  且齿侧留 0.15mm 齿隙，装配不咬死。
// =====================================================================

module tooth_prism(z = 20, m = 1, t = 6, clearance = 0.15) {
    p  = PI * m;                      // 周节
    rp = m * z / 2;
    ra = rp + m;
    rf = max(1.2, rp - 1.25 * m);
    rb = rf - 0.6;                    // 底部内嵌半径（保证与根圆重叠）

    hw_p = p / 4 - clearance / 2;     // 分度圆处半齿宽
    k    = tan(20);                   // 压力角正切

    hw_b = hw_p + (rp - rb) * k;      // 底部半宽
    hw_a = max(0.12, hw_p - (ra - rp) * k);   // 顶部半宽

    linear_extrude(height = t, convexity = 4)
        polygon([[-hw_b, rb], [hw_b, rb], [hw_a, ra], [-hw_a, ra]]);
}

module gear(z = 20, m = 1, t = 6, bore = 0, clearance = 0.15) {
    rp = m * z / 2;
    rf = max(1.2, rp - 1.25 * m);

    difference() {
        union() {
            cylinder(r = rf, h = t, $fn = max(48, z * 6));
            for (k = [0 : z - 1])
                rotate([0, 0, k * 360 / z])
                    translate([0, 0, 0])
                        tooth_prism(z = z, m = m, t = t, clearance = clearance);
        }
        if (bore > 0)
            cylinder(d = bore, h = t + 2, center = true, $fn = 48);
    }
}

/* 齿条齿块（供滑块使用） */
module rack_teeth(len, m = 1, t = 2.25, pa = 20) {
    p   = PI * m;
    n   = floor(len / p);
    hw1 = p / 4 + m * tan(pa);
    hw2 = p / 4 - m * tan(pa);
    for (i = [0 : n - 1])
        translate([i * p, 0, 0])
            linear_extrude(height = t, convexity = 4)
                polygon([[-hw1, -0.6], [hw1, -0.6], [hw2, t], [-hw2, t]]);
}
