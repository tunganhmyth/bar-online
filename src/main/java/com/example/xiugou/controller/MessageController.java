package com.example.xiugou.controller;

import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;

@Controller
public class MessageController {
    @RequestMapping({"/", "/index"})
    public String index(Model model) {
        model.addAttribute("username", "");
        return "index";
    }

    @RequestMapping("/index/{username}")
    public String channel(Model model, @PathVariable String username) {
        model.addAttribute("username", username);
        return "index";
    }
}
